import mqtt from "mqtt";
import { storage } from "./storage";
import type { Sensor } from "@shared/schema";
import { writeFile, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

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

interface BufferedReading {
  sensorId: string;
  value: string;
  timestamp: Date;
  isSimulated: boolean;
}

class MqttService {
  private connections: Map<string, MqttConnection> = new Map();
  private initialized = false;
  private reconnectInterval = 30000; // 30 seconds
  private maxReconnectAttempts = 5;

  // Buffer para almacenar lecturas antes de escribir en BD
  private readingsBuffer: BufferedReading[] = [];
  private bufferFilePath = path.join(process.cwd(), 'mqtt-readings-buffer.json');
  private flushInterval = 3600000; // 1 hora en milisegundos
  private flushTimer: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn("MQTT Service already initialized");
      return;
    }

    logger.info("Initializing MQTT Service...");

    try {
      // Cargar buffer existente si hay
      await this.loadBufferFromFile();

      // Load all sensors with MQTT enabled
      await this.refreshMqttConnections();
      this.initialized = true;
      logger.info("MQTT Service initialized successfully");

      // Iniciar timer de flush cada hora
      this.startFlushTimer();

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

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    logger.info("⏰ Starting flush timer - will write to DB every hour");

    this.flushTimer = setInterval(async () => {
      await this.flushBufferToDatabase();
    }, this.flushInterval);
  }

  private async loadBufferFromFile(): Promise<void> {
    try {
      if (existsSync(this.bufferFilePath)) {
        const data = await readFile(this.bufferFilePath, 'utf-8');
        const loadedBuffer = JSON.parse(data);

        // Convertir timestamps de string a Date
        this.readingsBuffer = loadedBuffer.map((reading: any) => ({
          ...reading,
          timestamp: new Date(reading.timestamp)
        }));

        logger.info(`📂 Loaded ${this.readingsBuffer.length} buffered readings from file`);
      }
    } catch (error) {
      logger.error("Error loading buffer from file", error);
      this.readingsBuffer = [];
    }
  }

  private async saveBufferToFile(): Promise<void> {
    try {
      logger.info("💾 ATTEMPTING TO SAVE BUFFER TO FILE", {
        bufferSize: this.readingsBuffer.length,
        filePath: this.bufferFilePath
      });
      
      const data = JSON.stringify(this.readingsBuffer, null, 2);
      await writeFile(this.bufferFilePath, data, 'utf-8');
      
      logger.info(`💾 ✅ SUCCESSFULLY SAVED ${this.readingsBuffer.length} readings to buffer file`, {
        filePath: this.bufferFilePath,
        fileSize: data.length
      });
    } catch (error) {
      logger.error("💾 ❌ ERROR SAVING BUFFER TO FILE", {
        filePath: this.bufferFilePath,
        error: error.message,
        stack: error.stack
      });
    }
  }

  private async flushBufferToDatabase(): Promise<void> {
    if (this.readingsBuffer.length === 0) {
      logger.info("⏭️ No readings to flush - buffer is empty");
      return;
    }

    const readingsToFlush = [...this.readingsBuffer];
    const flushCount = readingsToFlush.length;

    logger.info(`🚀 Starting DB flush - ${flushCount} readings to insert`, {
      firstTimestamp: readingsToFlush[0]?.timestamp,
      lastTimestamp: readingsToFlush[flushCount - 1]?.timestamp
    });

    try {
      // Insertar todas las lecturas en la base de datos
      let successCount = 0;
      let errorCount = 0;

      for (const reading of readingsToFlush) {
        try {
          await storage.createSensorReading({
            sensorId: reading.sensorId,
            value: reading.value,
            timestamp: reading.timestamp,
            isSimulated: reading.isSimulated
          });
          successCount++;
        } catch (error) {
          logger.error(`Error inserting reading for sensor ${reading.sensorId}`, error);
          errorCount++;
        }
      }

      logger.info(`✅ DB flush completed`, {
        total: flushCount,
        success: successCount,
        errors: errorCount
      });

      // Limpiar el buffer solo de las lecturas exitosamente insertadas
      if (errorCount === 0) {
        this.readingsBuffer = [];

        // Eliminar archivo de buffer
        if (existsSync(this.bufferFilePath)) {
          await unlink(this.bufferFilePath);
          logger.info("🗑️ Buffer file deleted after successful flush");
        }
      } else {
        // Si hubo errores, mantener las lecturas fallidas en el buffer
        logger.warn(`⚠️ Keeping ${errorCount} failed readings in buffer for retry`);
      }

    } catch (error) {
      logger.error("💥 Critical error during DB flush", error);
      // Mantener el buffer para reintentar
    }
  }

  async refreshMqttConnections(): Promise<void> {
    try {
      logger.info("Refreshing MQTT connections...");

      // Import storage to get sensors
      const { storage } = await import("./storage");

      // Get all sensors that have MQTT enabled from the database
      logger.info("Loading MQTT-enabled sensors from database...");

      try {
        const mqttEnabledSensors = await storage.getAllMqttEnabledSensors();
        logger.info("🔍🔍🔍 DETAILED MQTT SENSORS ANALYSIS", {
          totalSensorsFound: mqttEnabledSensors.length,
          sensorsDetail: mqttEnabledSensors.map(s => ({
            id: s.id,
            name: s.name,
            mqttEnabled: s.mqttEnabled,
            isActive: s.isActive,
            mqttHost: s.mqttHost,
            mqttPort: s.mqttPort,
            ttnTopic: s.ttnTopic,
            jsonFields: s.jsonFields,
            mqttUsername: s.mqttUsername ? `${s.mqttUsername.substring(0, 8)}...` : 'MISSING',
            hasPassword: !!s.mqttPassword,
            shouldConnect: !!(s.mqttEnabled && s.isActive && s.mqttHost && s.mqttPort && s.ttnTopic && s.mqttUsername && s.mqttPassword)
          })),
        });

        // Filter out sensors that don't have complete configuration
        const validSensors = mqttEnabledSensors.filter(sensor => {
          const isValid = !!(sensor.mqttEnabled && sensor.isActive && sensor.mqttHost && sensor.mqttPort && sensor.ttnTopic && sensor.mqttUsername && sensor.mqttPassword);

          if (!isValid) {
            logger.warn("⚠️⚠️⚠️ SENSOR WITH INCOMPLETE MQTT CONFIG", {
              sensorId: sensor.id,
              name: sensor.name,
              mqttEnabled: sensor.mqttEnabled,
              isActive: sensor.isActive,
              hasHost: !!sensor.mqttHost,
              hasPort: !!sensor.mqttPort,
              hasTopic: !!sensor.ttnTopic,
              hasUsername: !!sensor.mqttUsername,
              hasPassword: !!sensor.mqttPassword,
            });
          }

          return isValid;
        });

        logger.info("✅✅✅ VALID SENSORS FOR MQTT CONNECTION", {
          validSensorsCount: validSensors.length,
          totalSensorsCount: mqttEnabledSensors.length,
          invalidSensorsCount: mqttEnabledSensors.length - validSensors.length,
        });

        // Group sensors by connection key (host:port:username)
        const sensorsByConnection = new Map<string, Sensor[]>();

        for (const sensor of validSensors) {
          const connectionKey = `${sensor.mqttHost}:${sensor.mqttPort}:${sensor.mqttUsername}`;
          if (!sensorsByConnection.has(connectionKey)) {
            sensorsByConnection.set(connectionKey, []);
          }
          sensorsByConnection.get(connectionKey)!.push(sensor);
        }

        logger.info("🗂️🗂️🗂️ SENSOR GROUPS BY CONNECTION", {
          connectionGroups: Array.from(sensorsByConnection.entries()).map(([key, sensors]) => ({
            connectionKey: key,
            sensorsCount: sensors.length,
            sensors: sensors.map(s => ({
              id: s.id,
              name: s.name,
              topic: s.ttnTopic,
              jsonFields: s.jsonFields,
            })),
          })),
        });

        // Connect each group of sensors
        for (const [connectionKey, sensors] of sensorsByConnection.entries()) {
          logger.info("🚀🚀🚀 CONNECTING SENSOR GROUP", {
            connectionKey,
            sensorsCount: sensors.length,
            sensors: sensors.map(s => ({ id: s.id, name: s.name, topic: s.ttnTopic })),
          });

          try {
            await this.ensureConnection(connectionKey, sensors);
            logger.info("✅✅✅ SENSOR GROUP CONNECTION SUCCESS", {
              connectionKey,
              sensorsConnected: sensors.length,
            });
          } catch (connectionError) {
            logger.error("❌❌❌ SENSOR GROUP CONNECTION FAILED", {
              connectionKey,
              sensorsCount: sensors.length,
              error: connectionError.message,
              errorStack: connectionError.stack,
            });
          }
        }
      } catch (storageError) {
        logger.error("💥💥💥 ERROR LOADING MQTT SENSORS FROM STORAGE", {
          error: storageError.message,
          errorStack: storageError.stack,
        });
      }

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

      // Get unique topics to avoid duplicate subscriptions
      const uniqueTopics = new Set<string>();
      sensors.forEach((s) => {
        if (s.ttnTopic) {
          uniqueTopics.add(s.ttnTopic);
        }
      });

      // Subscribe to any new topics only once per unique topic
      for (const topic of uniqueTopics) {
        existingConnection.client.subscribe(topic, { qos: 0 }, (err) => {
          if (err) {
            logger.error(
              `Failed to subscribe to topic ${topic}`,
              err,
            );
          } else {
            logger.info(`Subscribed to topic: ${topic}`, {
              sensorsCount: sensors.filter(s => s.ttnTopic === topic).length,
            });
          }
        });
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
    client.on("connect", async () => {
      logger.info("🟢 MQTT CONNECTED SUCCESSFULLY", {
        connectionKey,
        host: firstSensor.mqttHost,
        port: firstSensor.mqttPort,
        username: firstSensor.mqttUsername,
        sensorsToSubscribe: sensors.length,
      });
      connection.lastConnected = new Date();
      connection.reconnectCount = 0;

      // Get unique topics to avoid duplicate subscriptions
      const topicSensorMap = new Map<string, Sensor[]>();
      sensors.forEach(sensor => {
        if (sensor.ttnTopic) {
          if (!topicSensorMap.has(sensor.ttnTopic)) {
            topicSensorMap.set(sensor.ttnTopic, []);
          }
          topicSensorMap.get(sensor.ttnTopic)!.push(sensor);
        } else {
          logger.warn("⚠️⚠️⚠️ SENSOR MISSING TTN TOPIC", {
            sensorId: sensor.id,
            sensorName: sensor.name,
            connectionKey,
            sensorConfig: {
              mqttHost: sensor.mqttHost,
              mqttPort: sensor.mqttPort,
              ttnTopic: sensor.ttnTopic,
              jsonFields: sensor.jsonFields,
            },
          });
        }
      });

      // Subscribe to all unique topics
      const subscriptionPromises: Promise<void>[] = [];

      for (const [topic, topicSensors] of topicSensorMap.entries()) {
        logger.info("📡📡📡 ATTEMPTING TOPIC SUBSCRIPTION", {
          topic,
          sensorsCount: topicSensors.length,
          sensors: topicSensors.map(s => ({ id: s.id, name: s.name, jsonFields: s.jsonFields })),
          connectionKey,
        });

        const subscriptionPromise = new Promise<void>((resolve, reject) => {
          client.subscribe(topic, { qos: 0 }, (err, granted) => {
            if (err) {
              logger.error("❌❌❌ SUBSCRIPTION FAILED", {
                topic,
                sensorsCount: topicSensors.length,
                error: err.message,
                errorCode: err.name,
                connectionKey,
              });
              reject(err);
            } else {
              logger.info("✅✅✅ SUBSCRIPTION SUCCESS", {
                topic,
                sensorsCount: topicSensors.length,
                sensors: topicSensors.map(s => ({ id: s.id, name: s.name })),
                granted: granted,
                qos: granted?.[0]?.qos,
                connectionKey,
              });
              resolve();
            }
          });
        });

        subscriptionPromises.push(subscriptionPromise);
      }

      // Wait for all subscriptions to complete
      try {
        await Promise.all(subscriptionPromises);
        logger.info("🎉🎉🎉 ALL SUBSCRIPTIONS COMPLETED", {
          connectionKey,
          totalUniqueTopics: topicSensorMap.size,
          totalSensors: sensors.length,
          sensorsWithTopics: sensors.filter(s => s.ttnTopic).length,
        });
      } catch (subscriptionError) {
        logger.error("💥💥💥 SOME SUBSCRIPTIONS FAILED", {
          connectionKey,
          error: subscriptionError.message,
        });
      }
    });

    client.on("message", async (topic, message) => {
      logger.info("📨📨📨 MQTT MESSAGE RECEIVED", {
        topic,
        messageSize: message.length,
        timestamp: new Date().toISOString(),
      });

      try {
        await this.handleMqttMessage(topic, message, sensors);
      } catch (error) {
        logger.error("💥💥💥 ERROR in message handler", {
          topic,
          error: error.message,
          stack: error.stack,
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
      logger.info("🔔 MQTT MESSAGE - PROCESSING", {
        topic,
        messageLength: message.length,
        availableSensors: sensors.length,
      });

      const messageStr = message.toString();

      let messageData: any;

      try {
        const fullMessageData = JSON.parse(messageStr);

        // Extraer uplink_message.decoded_payload si existe
        messageData =
          fullMessageData.uplink_message?.decoded_payload || fullMessageData;

        logger.info("✅ JSON PARSE SUCCESS", {
          topic,
          extractedDataKeys: Object.keys(messageData),
          dataSource: fullMessageData.uplink_message?.decoded_payload
            ? "uplink_message.decoded_payload"
            : "root",
        });
      } catch (parseError) {
        logger.error("❌ JSON PARSE FAILED", {
          topic,
          parseError: parseError.message,
        });
        return;
      }

      // Find sensors that match this topic
      const matchingSensors = sensors.filter((s) => s.ttnTopic === topic);

      logger.info("🎯 TOPIC MATCHING RESULTS", {
        topic,
        matchingSensorsCount: matchingSensors.length,
        matchingSensors: matchingSensors.map((s) => ({
          id: s.id,
          name: s.name,
          jsonFields: s.jsonFields,
        })),
      });

      if (matchingSensors.length === 0) {
        logger.warn("⚠️ NO MATCHING SENSORS FOUND", {
          receivedTopic: topic,
          availableTopics: sensors.map((s) => s.ttnTopic),
        });
        return;
      }

      for (const sensor of matchingSensors) {
        try {
          await this.processSensorMessage(sensor, messageData);
        } catch (processingError) {
          logger.error(`❌ SENSOR PROCESSING FAILED: ${sensor.name}`, {
            sensorId: sensor.id,
            error: processingError.message,
          });
        }
      }

    } catch (error) {
      logger.error("💥 CRITICAL ERROR in handleMqttMessage", {
        topic,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  private async processSensorMessage(
    sensor: Sensor,
    messageData: any,
  ): Promise<void> {
    try {
      logger.info(`🚀 PROCESSING SENSOR: ${sensor.name}`, {
        sensorId: sensor.id,
        jsonFields: sensor.jsonFields,
        messageDataKeys: Object.keys(messageData),
      });

      // Extract the specified JSON fields
      const fieldsToRead = sensor.jsonFields
        ? sensor.jsonFields.split(",").map((f) => f.trim())
        : [];

      if (fieldsToRead.length === 0) {
        logger.error("❌ NO JSON FIELDS SPECIFIED", {
          sensorId: sensor.id,
          sensorName: sensor.name,
        });
        return;
      }

      // Extract values from message data
      const extractedValues: Record<string, any> = {};

      for (const field of fieldsToRead) {
        const value = this.extractNestedValue(messageData, field);

        if (value !== undefined) {
          extractedValues[field] = value;
        } else {
          logger.warn(`⚠️ FIELD NOT FOUND: "${field}"`, {
            sensorId: sensor.id,
            availableFields: Object.keys(messageData || {}),
          });
        }
      }

      if (Object.keys(extractedValues).length === 0) {
        logger.error("❌ NO MATCHING FIELDS FOUND", {
          sensorId: sensor.id,
          sensorName: sensor.name,
          requestedFields: fieldsToRead,
          availableFields: Object.keys(messageData || {}),
        });
        return;
      }

      // Extract the actual numeric value from the first field
      const firstField = fieldsToRead[0];
      const actualValue = extractedValues[firstField];
      const readingValue = actualValue.toString();

      // Extract timestamp from the message data, keep in UTC
      let messageTimestamp = new Date(); // fallback to current time in UTC

      if (messageData.timestamp) {
        try {
          const parsedTime = new Date(messageData.timestamp);

          if (!isNaN(parsedTime.getTime())) {
            messageTimestamp = parsedTime;

            logger.info("✅ TIMESTAMP PARSED (UTC)", {
              sensorId: sensor.id,
              originalTimestamp: messageData.timestamp,
              storedUTCTime: messageTimestamp.toISOString(),
            });
          } else {
            logger.warn("⚠️ INVALID TIMESTAMP - USING CURRENT UTC", {
              sensorId: sensor.id,
              invalidTimestamp: messageData.timestamp,
            });
          }
        } catch (timestampError) {
          logger.error("❌ ERROR PARSING TIMESTAMP", {
            sensorId: sensor.id,
            timestampError: timestampError.message,
          });
        }
      }

      // AGREGAR AL BUFFER EN LUGAR DE ESCRIBIR DIRECTAMENTE A LA BD
      const bufferedReading: BufferedReading = {
        sensorId: sensor.id,
        value: readingValue,
        timestamp: messageTimestamp,
        isSimulated: false
      };

      this.readingsBuffer.push(bufferedReading);

      logger.info("📦 READING ADDED TO BUFFER", {
        sensorId: sensor.id,
        sensorName: sensor.name,
        value: readingValue,
        timestamp: messageTimestamp.toISOString(),
        bufferSize: this.readingsBuffer.length,
        bufferFilePath: this.bufferFilePath,
        nextFlush: "in 1 hour or on shutdown"
      });

      // Guardar buffer en archivo inmediatamente en la primera lectura y luego cada 10
      if (this.readingsBuffer.length === 1 || this.readingsBuffer.length % 10 === 0) {
        logger.info("💾 Triggering buffer save to file from MQTT message", {
          bufferSize: this.readingsBuffer.length,
          filePath: this.bufferFilePath
        });
        await this.saveBufferToFile();
      }

    } catch (error) {
      logger.error("💥 CRITICAL ERROR in processSensorMessage", {
        sensorId: sensor.id,
        sensorName: sensor.name,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  private extractNestedValue(obj: any, path: string): any {
    const pathSegments = path.split(".");
    let current = obj;

    for (const key of pathSegments) {
      if (current && current[key] !== undefined) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  // Public method to connect a specific sensor to MQTT
  async connectSensor(sensor: Sensor): Promise<void> {
    logger.info("🚀 CONNECT SENSOR REQUEST", {
      sensorId: sensor.id,
      sensorName: sensor.name,
      mqttEnabled: sensor.mqttEnabled,
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
      });
      return;
    }

    const connectionKey = `${sensor.mqttHost}:${sensor.mqttPort}:${sensor.mqttUsername}`;
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

    // Flush buffer antes de cerrar
    await this.flushBufferToDatabase();

    // Detener timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

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

  // Public method to manually flush buffer (useful for testing)
  async forceFlush(): Promise<void> {
    logger.info("🔧 Manual flush requested");
    await this.flushBufferToDatabase();
  }

  // Public method to add readings to buffer (for simulated "real" readings)
  async addReadingToBuffer(reading: BufferedReading): Promise<void> {
    this.readingsBuffer.push(reading);
    
    logger.info("📦 SIMULATED REAL READING ADDED TO BUFFER", {
      sensorId: reading.sensorId,
      value: reading.value,
      timestamp: reading.timestamp.toISOString(),
      bufferSize: this.readingsBuffer.length,
      bufferFilePath: this.bufferFilePath,
      nextFlush: "in 1 hour or on shutdown"
    });

    // Guardar buffer en archivo inmediatamente en la primera lectura y luego cada 10
    if (this.readingsBuffer.length === 1 || this.readingsBuffer.length % 10 === 0) {
      logger.info("💾 Triggering buffer save to file", {
        bufferSize: this.readingsBuffer.length,
        filePath: this.bufferFilePath
      });
      await this.saveBufferToFile();
    }
  }
}

// Export singleton instance
export const mqttService = new MqttService();