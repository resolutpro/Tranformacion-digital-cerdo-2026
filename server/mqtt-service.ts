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
        this.refreshMqttConnections().catch(error => {
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

  private async ensureConnection(connectionKey: string, sensors: Sensor[]): Promise<void> {
    const existingConnection = this.connections.get(connectionKey);
    
    // If connection exists and is connected, just update sensor list
    if (existingConnection && existingConnection.client.connected) {
      // Update sensor list
      existingConnection.sensors.clear();
      sensors.forEach(s => existingConnection.sensors.add(s.id));
      
      // Subscribe to any new topics
      for (const sensor of sensors) {
        if (sensor.ttnTopic) {
          existingConnection.client.subscribe(sensor.ttnTopic, (err) => {
            if (err) {
              logger.error(`Failed to subscribe to topic ${sensor.ttnTopic}`, err);
            } else {
              logger.info(`Subscribed to topic: ${sensor.ttnTopic}`, { sensorId: sensor.id });
            }
          });
        }
      }
      return;
    }

    // Create new connection or reconnect
    const firstSensor = sensors[0];
    if (!firstSensor.mqttHost || !firstSensor.mqttPort || !firstSensor.mqttUsername || !firstSensor.mqttPassword) {
      logger.warn("Incomplete MQTT credentials for sensor", { sensorId: firstSensor.id });
      return;
    }

    logger.info("Creating MQTT connection", { 
      connectionKey, 
      host: firstSensor.mqttHost,
      port: firstSensor.mqttPort,
      sensorsCount: sensors.length
    });

    const connectOptions: mqtt.IClientOptions = {
      host: firstSensor.mqttHost,
      port: firstSensor.mqttPort,
      username: firstSensor.mqttUsername,
      password: firstSensor.mqttPassword,
      protocol: 'mqtts',
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
      sensors: new Set(sensors.map(s => s.id)),
      reconnectCount: 0,
    };

    this.connections.set(connectionKey, connection);

    // Set up event handlers
    client.on('connect', () => {
      logger.info("🟢 MQTT CONNECTED SUCCESSFULLY", { 
        connectionKey,
        host: firstSensor.mqttHost,
        port: firstSensor.mqttPort,
        username: firstSensor.mqttUsername,
        sensorsToSubscribe: sensors.length
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
            connectionKey
          });

          client.subscribe(sensor.ttnTopic, (err) => {
            if (err) {
              logger.error("❌ SUBSCRIPTION FAILED", { 
                topic: sensor.ttnTopic,
                sensorId: sensor.id,
                sensorName: sensor.name,
                error: err.message,
                connectionKey
              });
            } else {
              logger.info("✅ SUBSCRIPTION SUCCESS", { 
                topic: sensor.ttnTopic,
                sensorId: sensor.id,
                sensorName: sensor.name,
                connectionKey
              });
            }
          });
        } else {
          logger.warn("⚠️ SENSOR HAS NO TTN TOPIC", { 
            sensorId: sensor.id,
            sensorName: sensor.name,
            connectionKey
          });
        }
      }
    });

    client.on('message', async (topic, message) => {
      logger.info("📨 MQTT MESSAGE EVENT TRIGGERED", { 
        topic,
        messageSize: message.length,
        connectionKey,
        timestamp: new Date().toISOString()
      });

      try {
        await this.handleMqttMessage(topic, message, sensors);
      } catch (error) {
        logger.error("💥 ERROR in message handler", { topic, error: error.message, stack: error.stack });
      }
    });

    client.on('error', (error) => {
      logger.error("🔴 MQTT CONNECTION ERROR", { 
        connectionKey, 
        error: error.message, 
        errorCode: error.code,
        errorStack: error.stack,
        host: firstSensor.mqttHost,
        port: firstSensor.mqttPort
      });
    });

    client.on('offline', () => {
      logger.warn("🟡 MQTT CONNECTION OFFLINE", { 
        connectionKey,
        lastConnected: connection.lastConnected,
        timestamp: new Date().toISOString()
      });
    });

    client.on('close', () => {
      logger.warn("🔵 MQTT CONNECTION CLOSED", { 
        connectionKey,
        timestamp: new Date().toISOString()
      });
    });

    client.on('disconnect', () => {
      logger.warn("🟠 MQTT DISCONNECTED", { 
        connectionKey,
        timestamp: new Date().toISOString()
      });
    });

    client.on('reconnect', () => {
      connection.reconnectCount++;
      logger.info("🔄 MQTT RECONNECTING", { 
        connectionKey, 
        attempt: connection.reconnectCount,
        maxAttempts: this.maxReconnectAttempts,
        timestamp: new Date().toISOString()
      });
      
      if (connection.reconnectCount > this.maxReconnectAttempts) {
        logger.error("❌ MAX RECONNECT ATTEMPTS REACHED", { 
          connectionKey,
          finalAttempt: connection.reconnectCount
        });
        client.end();
      }
    });
  }

  private async handleMqttMessage(topic: string, message: Buffer, sensors: Sensor[]): Promise<void> {
    try {
      logger.info("🔔 RAW MQTT MESSAGE RECEIVED", { 
        topic, 
        messageLength: message.length,
        availableSensors: sensors.length,
        sensorTopics: sensors.map(s => ({ id: s.id, name: s.name, topic: s.ttnTopic }))
      });

      const messageStr = message.toString();
      logger.info("📄 MESSAGE STRING", { 
        topic, 
        messageStr: messageStr.substring(0, 500), // Show more characters
        fullLength: messageStr.length 
      });

      let messageData: any;
      
      try {
        messageData = JSON.parse(messageStr);
        logger.info("✅ JSON PARSE SUCCESS", { 
          topic, 
          parsedDataKeys: Object.keys(messageData),
          parsedData: messageData 
        });
      } catch (parseError) {
        logger.error("❌ JSON PARSE FAILED", { 
          topic, 
          message: messageStr,
          parseError: parseError.message,
          messageType: typeof messageStr 
        });
        return;
      }

      // Find sensors that match this topic
      const matchingSensors = sensors.filter(s => s.ttnTopic === topic);
      logger.info("🎯 TOPIC MATCHING RESULTS", { 
        topic, 
        matchingSensorsCount: matchingSensors.length,
        matchingSensors: matchingSensors.map(s => ({ 
          id: s.id, 
          name: s.name, 
          expectedTopic: s.ttnTopic,
          jsonFields: s.jsonFields 
        })),
        allSensorTopics: sensors.map(s => s.ttnTopic)
      });
      
      if (matchingSensors.length === 0) {
        logger.warn("⚠️ NO MATCHING SENSORS FOUND", { 
          receivedTopic: topic,
          availableTopics: sensors.map(s => s.ttnTopic),
          topicComparison: sensors.map(s => ({
            sensorTopic: s.ttnTopic,
            matches: s.ttnTopic === topic,
            exactMatch: s.ttnTopic?.trim() === topic?.trim()
          }))
        });
        return;
      }

      for (const sensor of matchingSensors) {
        logger.info(`🔄 PROCESSING SENSOR: ${sensor.name}`, { 
          sensorId: sensor.id, 
          sensorName: sensor.name,
          sensorTopic: sensor.ttnTopic,
          jsonFields: sensor.jsonFields
        });
        await this.processSensorMessage(sensor, messageData);
      }

    } catch (error) {
      logger.error("💥 CRITICAL ERROR in handleMqttMessage", { topic, error: error.message, stack: error.stack });
    }
  }

  private async processSensorMessage(sensor: Sensor, messageData: any): Promise<void> {
    try {
      logger.info(`🚀 STARTING SENSOR MESSAGE PROCESSING`, { 
        sensorId: sensor.id, 
        sensorName: sensor.name,
        jsonFields: sensor.jsonFields,
        messageDataKeys: Object.keys(messageData),
        fullMessageData: messageData
      });

      // Extract the specified JSON fields
      const fieldsToRead = sensor.jsonFields ? sensor.jsonFields.split(',').map(f => f.trim()) : [];
      
      logger.info("📋 FIELDS TO EXTRACT", { 
        sensorId: sensor.id,
        rawJsonFields: sensor.jsonFields,
        parsedFields: fieldsToRead,
        fieldsCount: fieldsToRead.length
      });

      if (fieldsToRead.length === 0) {
        logger.error("❌ NO JSON FIELDS SPECIFIED", { 
          sensorId: sensor.id, 
          sensorName: sensor.name,
          jsonFieldsValue: sensor.jsonFields 
        });
        return;
      }

      // Extract values from message data
      const extractedValues: Record<string, any> = {};
      
      for (const field of fieldsToRead) {
        logger.info(`🔍 EXTRACTING FIELD: ${field}`, { 
          sensorId: sensor.id,
          field,
          messageDataStructure: this.getDataStructure(messageData)
        });

        const value = this.extractNestedValue(messageData, field);
        
        logger.info(`📊 FIELD EXTRACTION RESULT`, { 
          sensorId: sensor.id,
          field,
          extractedValue: value,
          valueType: typeof value,
          isUndefined: value === undefined
        });

        if (value !== undefined) {
          extractedValues[field] = value;
        }
      }

      logger.info("🎯 EXTRACTION SUMMARY", { 
        sensorId: sensor.id,
        requestedFields: fieldsToRead,
        extractedFields: Object.keys(extractedValues),
        extractedValues,
        availableTopLevelFields: Object.keys(messageData),
        messageDataSample: JSON.stringify(messageData).substring(0, 300)
      });

      if (Object.keys(extractedValues).length === 0) {
        logger.error("❌ NO MATCHING FIELDS FOUND", { 
          sensorId: sensor.id, 
          sensorName: sensor.name,
          requestedFields: fieldsToRead,
          availableFields: Object.keys(messageData),
          messageStructure: this.getDataStructure(messageData, 3), // Show nested structure
          fullMessage: messageData
        });
        return;
      }

      // Create sensor reading with extracted values
      const readingValue = JSON.stringify(extractedValues);
      
      logger.info("💾 SAVING SENSOR READING", { 
        sensorId: sensor.id,
        sensorName: sensor.name,
        readingValue,
        timestamp: new Date().toISOString()
      });

      const savedReading = await storage.createSensorReading({
        sensorId: sensor.id,
        value: readingValue,
        timestamp: new Date(),
        isSimulated: false,
      });

      logger.info("✅ SENSOR READING SAVED SUCCESSFULLY", { 
        sensorId: sensor.id,
        sensorName: sensor.name,
        readingId: savedReading.id,
        extractedFields: Object.keys(extractedValues),
        value: readingValue,
        timestamp: savedReading.timestamp
      });

    } catch (error) {
      logger.error("💥 CRITICAL ERROR in processSensorMessage", { 
        sensorId: sensor.id, 
        sensorName: sensor.name,
        error: error.message, 
        stack: error.stack,
        messageData 
      });
    }
  }

  private extractNestedValue(obj: any, path: string): any {
    logger.info(`🔍 EXTRACTING NESTED VALUE`, { 
      path, 
      startingObject: typeof obj === 'object' ? Object.keys(obj) : obj,
      pathSegments: path.split('.')
    });

    const result = path.split('.').reduce((current, key, index) => {
      logger.info(`📍 PATH STEP ${index + 1}`, { 
        currentKey: key,
        currentObjectType: typeof current,
        currentObjectKeys: current && typeof current === 'object' ? Object.keys(current) : 'not-object',
        hasKey: current && current[key] !== undefined,
        keyValue: current && current[key]
      });

      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);

    logger.info(`🎯 EXTRACTION COMPLETE`, { 
      path, 
      finalResult: result, 
      resultType: typeof result,
      wasSuccessful: result !== undefined
    });

    return result;
  }

  private getDataStructure(obj: any, maxDepth: number = 2, currentDepth: number = 0): any {
    if (currentDepth >= maxDepth || obj === null || typeof obj !== 'object') {
      return typeof obj;
    }

    if (Array.isArray(obj)) {
      return `Array[${obj.length}]`;
    }

    const structure: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        structure[key] = this.getDataStructure(obj[key], maxDepth, currentDepth + 1);
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
      hasPassword: !!sensor.mqttPassword
    });

    if (!sensor.mqttEnabled || !sensor.mqttHost || !sensor.mqttPort || !sensor.ttnTopic) {
      logger.error("❌ SENSOR MISSING REQUIRED MQTT CONFIGURATION", { 
        sensorId: sensor.id,
        sensorName: sensor.name,
        mqttEnabled: sensor.mqttEnabled,
        mqttHost: sensor.mqttHost,
        mqttPort: sensor.mqttPort,
        ttnTopic: sensor.ttnTopic,
        missingFields: [
          !sensor.mqttEnabled && 'mqttEnabled',
          !sensor.mqttHost && 'mqttHost',
          !sensor.mqttPort && 'mqttPort',
          !sensor.ttnTopic && 'ttnTopic'
        ].filter(Boolean)
      });
      return;
    }

    const connectionKey = `${sensor.mqttHost}:${sensor.mqttPort}:${sensor.mqttUsername}`;
    logger.info("🔑 CONNECTION KEY GENERATED", { 
      connectionKey,
      sensorId: sensor.id
    });

    await this.ensureConnection(connectionKey, [sensor]);
  }

  // Public method to disconnect a sensor from MQTT  
  async disconnectSensor(sensorId: string): Promise<void> {
    // Find and remove sensor from all connections
    for (const [connectionKey, connection] of this.connections.entries()) {
      if (connection.sensors.has(sensorId)) {
        connection.sensors.delete(sensorId);
        logger.info("Removed sensor from MQTT connection", { sensorId, connectionKey });
        
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