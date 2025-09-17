import mqtt from "mqtt";
import { storage } from "./storage";
import type { Sensor } from "@shared/schema";

// Simple logger for MQTT service
const logger = {
  info: (message: string, data?: any) => {
    console.log(
      `[MQTT-SERVICE] ${new Date().toISOString()} - ${message}`,
      data ? JSON.stringify(data, null, 2) : "",
    );
  },
  error: (message: string, error?: any) => {
    console.error(
      `[MQTT-SERVICE] ${new Date().toISOString()} - ${message}`,
      error?.message || error || "",
    );
  },
  warn: (message: string, data?: any) => {
    console.warn(
      `[MQTT-SERVICE] ${new Date().toISOString()} - ${message}`,
      data ? JSON.stringify(data, null, 2) : "",
    );
  },
};

interface MqttConnection {
  client: mqtt.MqttClient;
  host: string;
  port: number;
  sensors: Set<string>; // sensor IDs using this connection
  lastConnected?: Date;
  reconnectCount: number;
}

class MqttService {
  private connections: Map<string, MqttConnection> = new Map();
  private initialized = false;
  private reconnectInterval = 30000; // 30 seconds
  private maxReconnectAttempts = 5;

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn("MQTT Service already initialized");
      return;
    }

    logger.info("Initializing MQTT Service...");

    try {
      // Load all sensors with MQTT enabled
      await this.refreshMqttConnections();
      this.initialized = true;
      logger.info("MQTT Service initialized successfully");

      // Start periodic refresh of connections
      setInterval(() => {
        this.refreshMqttConnections().catch((error) => {
          logger.error("Error refreshing MQTT connections", error);
        });
      }, 60000); // Check every minute
    } catch (error) {
      logger.error("Failed to initialize MQTT Service", error);
      throw error;
    }
  }

  async refreshMqttConnections(): Promise<void> {
    try {
      logger.info("Refreshing MQTT connections...");

      // Get all sensors that have MQTT enabled
      // Note: This is a simplified approach - in a full system you'd query all organizations
      // For now, we'll connect any sensors that get configured via the API

      logger.info("MQTT connections refresh completed");
    } catch (error) {
      logger.error("Error refreshing MQTT connections", error);
    }
  }

  private async ensureConnection(
    connectionKey: string,
    sensors: Sensor[],
  ): Promise<void> {
    const existingConnection = this.connections.get(connectionKey);

    // If connection exists and is connected, just update sensor list
    if (existingConnection && existingConnection.client.connected) {
      // Update sensor list
      existingConnection.sensors.clear();
      sensors.forEach((s) => existingConnection.sensors.add(s.id));

      // Subscribe to any new topics
      for (const sensor of sensors) {
        if (sensor.ttnTopic) {
          existingConnection.client.subscribe(sensor.ttnTopic, (err) => {
            if (err) {
              logger.error(
                `Failed to subscribe to topic ${sensor.ttnTopic}`,
                err,
              );
            } else {
              logger.info(`Subscribed to topic: ${sensor.ttnTopic}`, {
                sensorId: sensor.id,
              });
            }
          });
        }
      }
      return;
    }

    // Create new connection or reconnect
    const firstSensor = sensors[0];
    if (
      !firstSensor.mqttHost ||
      !firstSensor.mqttPort ||
      !firstSensor.mqttUsername ||
      !firstSensor.mqttPassword
    ) {
      logger.warn("Incomplete MQTT credentials for sensor", {
        sensorId: firstSensor.id,
      });
      return;
    }

    logger.info("Creating MQTT connection", {
      connectionKey,
      host: firstSensor.mqttHost,
      port: firstSensor.mqttPort,
      sensorsCount: sensors.length,
    });

    const connectOptions: mqtt.IClientOptions = {
      host: firstSensor.mqttHost,
      port: firstSensor.mqttPort,
      username: firstSensor.mqttUsername,
      password: firstSensor.mqttPassword,
      protocol: "mqtts",
      keepalive: 60,
      reconnectPeriod: this.reconnectInterval,
      connectTimeout: 30000,
      clean: true,
      rejectUnauthorized: true, // Enable TLS verification for security
    };

    const client = mqtt.connect(connectOptions);

    const connection: MqttConnection = {
      client,
      host: firstSensor.mqttHost,
      port: firstSensor.mqttPort,
      sensors: new Set(sensors.map((s) => s.id)),
      reconnectCount: 0,
    };

    this.connections.set(connectionKey, connection);

    // Set up event handlers
    client.on("connect", () => {
      logger.info("🟢 MQTT CONNECTED SUCCESSFULLY", {
        connectionKey,
        host: firstSensor.mqttHost,
        port: firstSensor.mqttPort,
        username: firstSensor.mqttUsername,
        sensorsToSubscribe: sensors.length,
      });
      connection.lastConnected = new Date();
      connection.reconnectCount = 0;

      // Subscribe to all topics for this connection
      for (const sensor of sensors) {
        if (sensor.ttnTopic) {
          logger.info("📡 ATTEMPTING SUBSCRIPTION", {
            sensorId: sensor.id,
            sensorName: sensor.name,
            topic: sensor.ttnTopic,
            connectionKey,
          });

          client.subscribe(sensor.ttnTopic, (err) => {
            if (err) {
              logger.error("❌ SUBSCRIPTION FAILED", {
                topic: sensor.ttnTopic,
                sensorId: sensor.id,
                sensorName: sensor.name,
                error: err.message,
                connectionKey,
              });
            } else {
              logger.info("✅ SUBSCRIPTION SUCCESS", {
                topic: sensor.ttnTopic,
                sensorId: sensor.id,
                sensorName: sensor.name,
                connectionKey,
              });
            }
          });
        } else {
          logger.warn("⚠️ SENSOR HAS NO TTN TOPIC", {
            sensorId: sensor.id,
            sensorName: sensor.name,
            connectionKey,
          });
        }
      }
    });

    client.on("message", async (topic, message) => {
      logger.info("📨📨📨 MQTT MESSAGE EVENT TRIGGERED - RAW EVENT", {
        topic,
        topicLength: topic?.length,
        messageSize: message.length,
        messagePreview: message.toString().substring(0, 100),
        connectionKey,
        sensorsInConnection: sensors.map((s) => ({
          id: s.id,
          name: s.name,
          topic: s.ttnTopic,
        })),
        timestamp: new Date().toISOString(),
        eventType: "mqtt-message-received",
      });

      try {
        logger.info("🔄🔄🔄 CALLING handleMqttMessage FROM MESSAGE EVENT", {
          topic,
          messageLength: message.length,
          sensorsCount: sensors.length,
          callStartTime: new Date().toISOString(),
        });

        await this.handleMqttMessage(topic, message, sensors);

        logger.info("✅✅✅ handleMqttMessage COMPLETED SUCCESSFULLY", {
          topic,
          callEndTime: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("💥💥💥 ERROR in message handler - HANDLER FAILED", {
          topic,
          error: error.message,
          stack: error.stack,
          errorType: error.constructor.name,
          handlerFailedAt: new Date().toISOString(),
        });
      }
    });

    client.on("error", (error) => {
      logger.error("🔴 MQTT CONNECTION ERROR", {
        connectionKey,
        error: error.message,
        errorCode: error.code,
        errorStack: error.stack,
        host: firstSensor.mqttHost,
        port: firstSensor.mqttPort,
      });
    });

    client.on("offline", () => {
      logger.warn("🟡 MQTT CONNECTION OFFLINE", {
        connectionKey,
        lastConnected: connection.lastConnected,
        timestamp: new Date().toISOString(),
      });
    });

    client.on("close", () => {
      logger.warn("🔵 MQTT CONNECTION CLOSED", {
        connectionKey,
        timestamp: new Date().toISOString(),
      });
    });

    client.on("disconnect", () => {
      logger.warn("🟠 MQTT DISCONNECTED", {
        connectionKey,
        timestamp: new Date().toISOString(),
      });
    });

    client.on("reconnect", () => {
      connection.reconnectCount++;
      logger.info("🔄 MQTT RECONNECTING", {
        connectionKey,
        attempt: connection.reconnectCount,
        maxAttempts: this.maxReconnectAttempts,
        timestamp: new Date().toISOString(),
      });

      if (connection.reconnectCount > this.maxReconnectAttempts) {
        logger.error("❌ MAX RECONNECT ATTEMPTS REACHED", {
          connectionKey,
          finalAttempt: connection.reconnectCount,
        });
        client.end();
      }
    });
  }

  private async handleMqttMessage(
    topic: string,
    message: Buffer,
    sensors: Sensor[],
  ): Promise<void> {
    try {
      logger.info("🔔🔔🔔 MQTT MESSAGE RECEIVED - STARTING PROCESSING", {
        topic,
        messageLength: message.length,
        bufferPreview: message.toString().substring(0, 100),
        availableSensors: sensors.length,
        sensorTopics: sensors.map((s) => ({
          id: s.id,
          name: s.name,
          topic: s.ttnTopic,
        })),
        timestamp: new Date().toISOString(),
        threadId: process.pid,
      });

      const messageStr = message.toString();
      logger.info("📄📄📄 MESSAGE STRING CONVERSION", {
        topic,
        messageStr: messageStr.substring(0, 1000), // Show even more characters
        fullLength: messageStr.length,
        encoding: "utf8",
        firstChars: messageStr.substring(0, 50),
        lastChars: messageStr.substring(Math.max(0, messageStr.length - 50)),
      });

      let messageData: any;

      try {
        logger.info("🔍🔍🔍 ATTEMPTING JSON PARSE", {
          topic,
          messageToParseLength: messageStr.length,
          messageToParsePreview: messageStr.substring(0, 200),
        });

        const fullMessageData = JSON.parse(messageStr);

        // Extraer uplink_message.decoded_payload si existe
        messageData =
          fullMessageData.uplink_message?.decoded_payload || fullMessageData;

        logger.info("✅✅✅ JSON PARSE SUCCESS - DATA EXTRACTED", {
          topic,
          fullMessageKeys: Object.keys(fullMessageData),
          hasUplinkMessage: !!fullMessageData.uplink_message,
          hasDecodedPayload: !!fullMessageData.uplink_message?.decoded_payload,
          extractedDataKeys: Object.keys(messageData),
          extractedData: messageData,
          dataType: typeof messageData,
          isObject: typeof messageData === "object",
          hasKeys: Object.keys(messageData).length > 0,
          dataSource: fullMessageData.uplink_message?.decoded_payload
            ? "uplink_message.decoded_payload"
            : "root",
        });
      } catch (parseError) {
        logger.error("❌❌❌ JSON PARSE FAILED - CRITICAL ERROR", {
          topic,
          message: messageStr,
          parseError: parseError.message,
          parseErrorStack: parseError.stack,
          messageType: typeof messageStr,
          isValidString: typeof messageStr === "string",
          stringLength: messageStr.length,
        });
        return;
      }

      // Find sensors that match this topic
      logger.info("🔍🔍🔍 SEARCHING FOR MATCHING SENSORS", {
        receivedTopic: topic,
        availableSensorsCount: sensors.length,
        allSensorData: sensors.map((s) => ({
          id: s.id,
          name: s.name,
          ttnTopic: s.ttnTopic,
          topicMatches: s.ttnTopic === topic,
          topicTrimMatches: s.ttnTopic?.trim() === topic?.trim(),
        })),
      });

      const matchingSensors = sensors.filter((s) => s.ttnTopic === topic);

      logger.info("🎯🎯🎯 TOPIC MATCHING RESULTS - DETAILED", {
        topic,
        matchingSensorsCount: matchingSensors.length,
        matchingSensors: matchingSensors.map((s) => ({
          id: s.id,
          name: s.name,
          expectedTopic: s.ttnTopic,
          jsonFields: s.jsonFields,
          mqttEnabled: s.mqttEnabled,
          isActive: s.isActive,
        })),
        allSensorTopics: sensors.map((s) => ({
          topic: s.ttnTopic,
          sensorId: s.id,
          name: s.name,
        })),
        exactTopicComparison: sensors.map((s) => ({
          sensorId: s.id,
          sensorName: s.name,
          sensorTopic: `"${s.ttnTopic}"`,
          receivedTopic: `"${topic}"`,
          matches: s.ttnTopic === topic,
          exactMatch: s.ttnTopic?.trim() === topic?.trim(),
          lengthMatch: s.ttnTopic?.length === topic?.length,
        })),
      });

      if (matchingSensors.length === 0) {
        logger.warn("⚠️⚠️⚠️ NO MATCHING SENSORS FOUND - WILL NOT PROCESS", {
          receivedTopic: topic,
          receivedTopicLength: topic.length,
          availableTopics: sensors.map((s) => s.ttnTopic),
          detailedComparison: sensors.map((s) => ({
            sensorId: s.id,
            sensorName: s.name,
            sensorTopic: s.ttnTopic,
            sensorTopicLength: s.ttnTopic?.length,
            matches: s.ttnTopic === topic,
            exactMatch: s.ttnTopic?.trim() === topic?.trim(),
            charByCharComparison: topic
              .split("")
              .map((char, idx) => ({
                index: idx,
                received: char,
                expected: s.ttnTopic?.[idx] || "undefined",
                match: char === s.ttnTopic?.[idx],
              }))
              .slice(0, 20), // First 20 chars
          })),
        });
        return;
      }

      logger.info("🚀🚀🚀 STARTING SENSOR PROCESSING LOOP", {
        matchingSensorsCount: matchingSensors.length,
        sensorsToProcess: matchingSensors.map((s) => ({
          id: s.id,
          name: s.name,
        })),
      });

      for (const sensor of matchingSensors) {
        logger.info(`🔄🔄🔄 PROCESSING INDIVIDUAL SENSOR: ${sensor.name}`, {
          sensorId: sensor.id,
          sensorName: sensor.name,
          sensorTopic: sensor.ttnTopic,
          jsonFields: sensor.jsonFields,
          sensorType: sensor.sensorType,
          isActive: sensor.isActive,
          processingStartTime: new Date().toISOString(),
        });

        try {
          await this.processSensorMessage(sensor, messageData);
          logger.info(`✅✅✅ SENSOR PROCESSING COMPLETED: ${sensor.name}`, {
            sensorId: sensor.id,
            processingEndTime: new Date().toISOString(),
          });
        } catch (processingError) {
          logger.error(`❌❌❌ SENSOR PROCESSING FAILED: ${sensor.name}`, {
            sensorId: sensor.id,
            error: processingError.message,
            stack: processingError.stack,
          });
        }
      }

      logger.info("🏁🏁🏁 MQTT MESSAGE PROCESSING COMPLETED", {
        topic,
        processedSensors: matchingSensors.length,
        totalProcessingTime: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        "💥💥💥 CRITICAL ERROR in handleMqttMessage - TOTAL FAILURE",
        {
          topic,
          error: error.message,
          stack: error.stack,
          errorType: error.constructor.name,
          timestamp: new Date().toISOString(),
        },
      );
    }
  }

  private async processSensorMessage(
    sensor: Sensor,
    messageData: any,
  ): Promise<void> {
    try {
      logger.info(`🚀🚀🚀 STARTING SENSOR MESSAGE PROCESSING - DETAILED`, {
        sensorId: sensor.id,
        sensorName: sensor.name,
        sensorType: sensor.sensorType,
        zoneId: sensor.zoneId,
        jsonFields: sensor.jsonFields,
        messageDataKeys: Object.keys(messageData),
        messageDataType: typeof messageData,
        fullMessageData: messageData,
        processingStartTime: new Date().toISOString(),
      });

      // Extract the specified JSON fields
      const fieldsToRead = sensor.jsonFields
        ? sensor.jsonFields.split(",").map((f) => f.trim())
        : [];

      logger.info("📋📋📋 FIELDS TO EXTRACT - DETAILED ANALYSIS", {
        sensorId: sensor.id,
        rawJsonFields: sensor.jsonFields,
        rawJsonFieldsType: typeof sensor.jsonFields,
        rawJsonFieldsLength: sensor.jsonFields?.length,
        parsedFields: fieldsToRead,
        fieldsCount: fieldsToRead.length,
        fieldsArray: fieldsToRead.map((f, idx) => ({
          index: idx,
          field: f,
          fieldLength: f.length,
        })),
      });

      if (fieldsToRead.length === 0) {
        logger.error("❌❌❌ NO JSON FIELDS SPECIFIED - CANNOT PROCEED", {
          sensorId: sensor.id,
          sensorName: sensor.name,
          jsonFieldsValue: sensor.jsonFields,
          jsonFieldsIsNull: sensor.jsonFields === null,
          jsonFieldsIsUndefined: sensor.jsonFields === undefined,
          jsonFieldsIsEmptyString: sensor.jsonFields === "",
        });
        return;
      }

      // Extract values from message data
      const extractedValues: Record<string, any> = {};

      logger.info("🔍🔍🔍 STARTING FIELD EXTRACTION LOOP", {
        sensorId: sensor.id,
        fieldsToProcess: fieldsToRead,
        messageDataAvailable: !!messageData,
        messageDataKeys: Object.keys(messageData || {}),
      });

      for (const field of fieldsToRead) {
        logger.info(`🔍🔍🔍 EXTRACTING FIELD: "${field}" - DETAILED`, {
          sensorId: sensor.id,
          field,
          fieldIndex: fieldsToRead.indexOf(field),
          fieldLength: field.length,
          messageDataStructure: this.getDataStructure(messageData),
          availableTopLevelKeys: Object.keys(messageData || {}),
        });

        const value = this.extractNestedValue(messageData, field);

        logger.info(`📊📊📊 FIELD EXTRACTION RESULT - DETAILED`, {
          sensorId: sensor.id,
          field,
          extractedValue: value,
          valueType: typeof value,
          isUndefined: value === undefined,
          isNull: value === null,
          isNumber: typeof value === "number",
          isString: typeof value === "string",
          isObject: typeof value === "object",
          valueStringified: JSON.stringify(value),
          extractionSuccessful: value !== undefined,
        });

        if (value !== undefined) {
          extractedValues[field] = value;
          logger.info(`✅✅✅ FIELD EXTRACTED SUCCESSFULLY: "${field}"`, {
            sensorId: sensor.id,
            field,
            value,
            extractedValueCount: Object.keys(extractedValues).length,
          });
        } else {
          logger.warn(`⚠️⚠️⚠️ FIELD NOT FOUND: "${field}"`, {
            sensorId: sensor.id,
            field,
            availableFields: Object.keys(messageData || {}),
            messageDataSample: JSON.stringify(messageData).substring(0, 200),
          });
        }
      }

      logger.info("🎯🎯🎯 EXTRACTION SUMMARY - COMPREHENSIVE", {
        sensorId: sensor.id,
        sensorName: sensor.name,
        requestedFields: fieldsToRead,
        requestedFieldsCount: fieldsToRead.length,
        extractedFields: Object.keys(extractedValues),
        extractedFieldsCount: Object.keys(extractedValues).length,
        extractedValues,
        extractionSuccessRate: `${Object.keys(extractedValues).length}/${fieldsToRead.length}`,
        availableTopLevelFields: Object.keys(messageData || {}),
        messageDataSample: JSON.stringify(messageData).substring(0, 500),
        fullMessageStructure: this.getDataStructure(messageData, 5),
      });

      if (Object.keys(extractedValues).length === 0) {
        logger.error("❌❌❌ NO MATCHING FIELDS FOUND - ABORTING SAVE", {
          sensorId: sensor.id,
          sensorName: sensor.name,
          requestedFields: fieldsToRead,
          requestedFieldsDetailed: fieldsToRead.map((f) => ({
            field: f,
            searched: true,
            found: false,
          })),
          availableFields: Object.keys(messageData || {}),
          messageStructure: this.getDataStructure(messageData, 5),
          fullMessage: messageData,
          possibleReasons: [
            "Field names do not match exactly",
            "Data is nested deeper than expected",
            "Message format has changed",
            "Sensor jsonFields configuration is incorrect",
          ],
        });
        return;
      }

      // Extract the actual numeric value from the first field
      // For single field sensors, use the first extracted value
      // For multiple field sensors, we could extend this logic
      const firstField = fieldsToRead[0];
      const actualValue = extractedValues[firstField];
      const readingValue = actualValue.toString();

      // Extract timestamp from the message data, convert from Madrid timezone to UTC
      let messageTimestamp = new Date(); // fallback to current time
      
      if (messageData.timestamp) {
        try {
          const timestampValue = messageData.timestamp;
          logger.info("🕒🕒🕒 PROCESSING TIMESTAMP FROM MESSAGE", {
            sensorId: sensor.id,
            rawTimestamp: timestampValue,
            timestampType: typeof timestampValue,
          });
          
          // Parse the timestamp from the message
          const parsedTime = new Date(timestampValue);
          
          if (!isNaN(parsedTime.getTime())) {
            // Convert from Madrid timezone (UTC+2) to UTC for storage
            // Subtract 2 hours to convert Madrid time to UTC
            messageTimestamp = new Date(parsedTime.getTime() - (2 * 60 * 60 * 1000));
            
            logger.info("✅✅✅ TIMESTAMP CONVERTED FROM MADRID TO UTC", {
              sensorId: sensor.id,
              originalTimestamp: timestampValue,
              parsedMadridTime: parsedTime.toISOString(),
              convertedUTCTime: messageTimestamp.toISOString(),
              timezoneOffset: "UTC+2 -> UTC",
            });
          } else {
            logger.warn("⚠️⚠️⚠️ INVALID TIMESTAMP IN MESSAGE - USING CURRENT TIME", {
              sensorId: sensor.id,
              invalidTimestamp: timestampValue,
              fallbackTime: messageTimestamp.toISOString(),
            });
          }
        } catch (timestampError) {
          logger.error("❌❌❌ ERROR PARSING TIMESTAMP - USING CURRENT TIME", {
            sensorId: sensor.id,
            timestampError: timestampError.message,
            rawTimestamp: messageData.timestamp,
            fallbackTime: messageTimestamp.toISOString(),
          });
        }
      } else {
        logger.warn("⚠️⚠️⚠️ NO TIMESTAMP IN MESSAGE - USING CURRENT TIME", {
          sensorId: sensor.id,
          availableFields: Object.keys(messageData || {}),
          fallbackTime: messageTimestamp.toISOString(),
        });
      }

      logger.info("💾💾💾 PREPARING TO SAVE SENSOR READING", {
        sensorId: sensor.id,
        sensorName: sensor.name,
        extractedField: firstField,
        actualValue,
        readingValue,
        readingValueLength: readingValue.length,
        extractedFieldsCount: Object.keys(extractedValues).length,
        messageTimestamp: messageTimestamp.toISOString(),
        isSimulated: false,
        databaseCallStartTime: new Date().toISOString(),
      });

      try {
        logger.info("🔄🔄🔄 CALLING STORAGE.createSensorReading", {
          sensorId: sensor.id,
          parameters: {
            sensorId: sensor.id,
            value: readingValue,
            timestamp: messageTimestamp,
            isSimulated: false,
            extractedFrom: firstField,
            originalExtractedValues: extractedValues,
          },
        });

        const savedReading = await storage.createSensorReading({
          sensorId: sensor.id,
          value: readingValue,
          timestamp: messageTimestamp, // Use timestamp from message
          isSimulated: false,
        });

        logger.info(
          "✅✅✅ SENSOR READING SAVED SUCCESSFULLY - DATABASE CONFIRMED",
          {
            sensorId: sensor.id,
            sensorName: sensor.name,
            readingId: savedReading.id,
            extractedField: firstField,
            extractedFields: Object.keys(extractedValues),
            actualValue,
            value: readingValue,
            timestamp: savedReading.timestamp,
            createdAt: savedReading.createdAt,
            isSimulated: savedReading.isSimulated,
            databaseSaveTime: new Date().toISOString(),
            savedReadingObject: savedReading,
            allExtractedValues: extractedValues,
          },
        );
      } catch (saveError) {
        logger.error("💥💥💥 DATABASE SAVE FAILED - CRITICAL ERROR", {
          sensorId: sensor.id,
          sensorName: sensor.name,
          extractedField: firstField,
          actualValue,
          readingValue,
          allExtractedValues: extractedValues,
          saveError: saveError.message,
          saveErrorStack: saveError.stack,
          saveErrorType: saveError.constructor.name,
        });
        throw saveError;
      }
    } catch (error) {
      logger.error(
        "💥💥💥 CRITICAL ERROR in processSensorMessage - COMPLETE FAILURE",
        {
          sensorId: sensor.id,
          sensorName: sensor.name,
          error: error.message,
          stack: error.stack,
          errorType: error.constructor.name,
          messageData,
          processingFailedAt: new Date().toISOString(),
        },
      );
    }
  }

  private extractNestedValue(obj: any, path: string): any {
    logger.info(`🔍🔍🔍 EXTRACTING NESTED VALUE - START`, {
      path,
      pathType: typeof path,
      pathLength: path?.length,
      startingObject: typeof obj === "object" ? Object.keys(obj) : obj,
      startingObjectType: typeof obj,
      pathSegments: path.split("."),
      segmentsCount: path.split(".").length,
    });

    const pathSegments = path.split(".");
    let current = obj;

    for (let index = 0; index < pathSegments.length; index++) {
      const key = pathSegments[index];

      logger.info(`📍📍📍 PATH STEP ${index + 1}/${pathSegments.length}`, {
        currentKey: key,
        keyIndex: index,
        keyType: typeof key,
        keyLength: key?.length,
        currentObjectType: typeof current,
        currentObjectIsNull: current === null,
        currentObjectIsUndefined: current === undefined,
        currentObjectKeys:
          current && typeof current === "object"
            ? Object.keys(current)
            : "not-object",
        currentObjectKeysCount:
          current && typeof current === "object"
            ? Object.keys(current).length
            : 0,
        hasKey: current && current[key] !== undefined,
        keyValue: current && current[key],
        keyValueType:
          current && current[key] ? typeof current[key] : "undefined",
        exactKeyMatch: current && typeof current === "object" && key in current,
        allKeysInCurrent:
          current && typeof current === "object" ? Object.keys(current) : [],
        keyComparison:
          current && typeof current === "object"
            ? Object.keys(current).map((k) => ({
                availableKey: k,
                searchingFor: key,
                exactMatch: k === key,
                caseInsensitiveMatch: k.toLowerCase() === key.toLowerCase(),
              }))
            : [],
      });

      if (current && current[key] !== undefined) {
        current = current[key];
        logger.info(`✅✅✅ KEY FOUND - MOVING DEEPER`, {
          key,
          newCurrent: current,
          newCurrentType: typeof current,
          remainingSteps: pathSegments.length - index - 1,
        });
      } else {
        logger.warn(`❌❌❌ KEY NOT FOUND - EXTRACTION FAILED`, {
          key,
          pathSoFar: pathSegments.slice(0, index + 1).join("."),
          remainingPath: pathSegments.slice(index + 1).join("."),
          currentWas: current,
          availableKeysWere:
            current && typeof current === "object"
              ? Object.keys(current)
              : "not-an-object",
        });
        return undefined;
      }
    }

    logger.info(`🎯🎯🎯 EXTRACTION COMPLETE - FINAL RESULT`, {
      path,
      finalResult: current,
      resultType: typeof current,
      resultIsNull: current === null,
      resultIsUndefined: current === undefined,
      wasSuccessful: current !== undefined,
      resultStringified: JSON.stringify(current),
    });

    return current;
  }

  private getDataStructure(
    obj: any,
    maxDepth: number = 2,
    currentDepth: number = 0,
  ): any {
    if (currentDepth >= maxDepth || obj === null || typeof obj !== "object") {
      return typeof obj;
    }

    if (Array.isArray(obj)) {
      return `Array[${obj.length}]`;
    }

    const structure: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        structure[key] = this.getDataStructure(
          obj[key],
          maxDepth,
          currentDepth + 1,
        );
      }
    }
    return structure;
  }

  // Public method to connect a specific sensor to MQTT
  async connectSensor(sensor: Sensor): Promise<void> {
    logger.info("🚀 CONNECT SENSOR REQUEST", {
      sensorId: sensor.id,
      sensorName: sensor.name,
      mqttEnabled: sensor.mqttEnabled,
      mqttHost: sensor.mqttHost,
      mqttPort: sensor.mqttPort,
      ttnTopic: sensor.ttnTopic,
      jsonFields: sensor.jsonFields,
      hasUsername: !!sensor.mqttUsername,
      hasPassword: !!sensor.mqttPassword,
    });

    if (
      !sensor.mqttEnabled ||
      !sensor.mqttHost ||
      !sensor.mqttPort ||
      !sensor.ttnTopic
    ) {
      logger.error("❌ SENSOR MISSING REQUIRED MQTT CONFIGURATION", {
        sensorId: sensor.id,
        sensorName: sensor.name,
        mqttEnabled: sensor.mqttEnabled,
        mqttHost: sensor.mqttHost,
        mqttPort: sensor.mqttPort,
        ttnTopic: sensor.ttnTopic,
        missingFields: [
          !sensor.mqttEnabled && "mqttEnabled",
          !sensor.mqttHost && "mqttHost",
          !sensor.mqttPort && "mqttPort",
          !sensor.ttnTopic && "ttnTopic",
        ].filter(Boolean),
      });
      return;
    }

    const connectionKey = `${sensor.mqttHost}:${sensor.mqttPort}:${sensor.mqttUsername}`;
    logger.info("🔑 CONNECTION KEY GENERATED", {
      connectionKey,
      sensorId: sensor.id,
    });

    await this.ensureConnection(connectionKey, [sensor]);
  }

  // Public method to disconnect a sensor from MQTT
  async disconnectSensor(sensorId: string): Promise<void> {
    // Find and remove sensor from all connections
    for (const [connectionKey, connection] of this.connections.entries()) {
      if (connection.sensors.has(sensorId)) {
        connection.sensors.delete(sensorId);
        logger.info("Removed sensor from MQTT connection", {
          sensorId,
          connectionKey,
        });

        // If no sensors left for this connection, close it
        if (connection.sensors.size === 0) {
          logger.info("Closing unused MQTT connection", { connectionKey });
          connection.client.end();
          this.connections.delete(connectionKey);
        }
      }
    }
  }

  async shutdown(): Promise<void> {
    logger.info("Shutting down MQTT Service...");

    for (const [connectionKey, connection] of this.connections.entries()) {
      logger.info("Closing MQTT connection", { connectionKey });
      connection.client.end();
    }

    this.connections.clear();
    this.initialized = false;
    logger.info("MQTT Service shutdown complete");
  }

  // Public method to manually refresh connections (useful for testing)
  async forceRefresh(): Promise<void> {
    logger.info("Forcing MQTT connections refresh");
    await this.refreshMqttConnections();
  }
}

// Export singleton instance
export const mqttService = new MqttService();
