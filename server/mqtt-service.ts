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
      logger.info("MQTT connected", { connectionKey });
      connection.lastConnected = new Date();
      connection.reconnectCount = 0;

      // Subscribe to all topics for this connection
      for (const sensor of sensors) {
        if (sensor.ttnTopic) {
          client.subscribe(sensor.ttnTopic, (err) => {
            if (err) {
              logger.error(`Failed to subscribe to topic ${sensor.ttnTopic}`, err);
            } else {
              logger.info(`Subscribed to topic: ${sensor.ttnTopic}`, { sensorId: sensor.id });
            }
          });
        }
      }
    });

    client.on('message', async (topic, message) => {
      try {
        await this.handleMqttMessage(topic, message, sensors);
      } catch (error) {
        logger.error("Error handling MQTT message", { topic, error });
      }
    });

    client.on('error', (error) => {
      logger.error("MQTT connection error", { connectionKey, error: error.message });
    });

    client.on('offline', () => {
      logger.warn("MQTT connection offline", { connectionKey });
    });

    client.on('reconnect', () => {
      connection.reconnectCount++;
      logger.info("MQTT reconnecting", { connectionKey, attempt: connection.reconnectCount });
      
      if (connection.reconnectCount > this.maxReconnectAttempts) {
        logger.error("Max reconnect attempts reached", { connectionKey });
        client.end();
      }
    });
  }

  private async handleMqttMessage(topic: string, message: Buffer, sensors: Sensor[]): Promise<void> {
    try {
      const messageStr = message.toString();
      let messageData: any;
      
      try {
        messageData = JSON.parse(messageStr);
      } catch (parseError) {
        logger.warn("Failed to parse MQTT message as JSON", { topic, message: messageStr });
        return;
      }

      logger.info("Received MQTT message", { topic, messagePreview: messageStr.substring(0, 200) });

      // Find sensors that match this topic
      const matchingSensors = sensors.filter(s => s.ttnTopic === topic);
      
      for (const sensor of matchingSensors) {
        await this.processSensorMessage(sensor, messageData);
      }

    } catch (error) {
      logger.error("Error handling MQTT message", { topic, error });
    }
  }

  private async processSensorMessage(sensor: Sensor, messageData: any): Promise<void> {
    try {
      // Extract the specified JSON fields
      const fieldsToRead = sensor.jsonFields ? sensor.jsonFields.split(',').map(f => f.trim()) : [];
      
      if (fieldsToRead.length === 0) {
        logger.warn("No JSON fields specified for sensor", { sensorId: sensor.id });
        return;
      }

      // Extract values from message data
      const extractedValues: Record<string, any> = {};
      
      for (const field of fieldsToRead) {
        const value = this.extractNestedValue(messageData, field);
        if (value !== undefined) {
          extractedValues[field] = value;
        }
      }

      if (Object.keys(extractedValues).length === 0) {
        logger.warn("No matching fields found in message", { 
          sensorId: sensor.id, 
          requestedFields: fieldsToRead,
          availableFields: Object.keys(messageData)
        });
        return;
      }

      // Create sensor reading with extracted values
      const readingValue = JSON.stringify(extractedValues);
      
      await storage.createSensorReading({
        sensorId: sensor.id,
        value: readingValue,
        timestamp: new Date(),
        isSimulated: false,
      });

      logger.info("Created sensor reading from MQTT", { 
        sensorId: sensor.id,
        sensorName: sensor.name,
        extractedFields: Object.keys(extractedValues),
        value: readingValue
      });

    } catch (error) {
      logger.error("Error processing sensor message", { sensorId: sensor.id, error });
    }
  }

  private extractNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  // Public method to connect a specific sensor to MQTT
  async connectSensor(sensor: Sensor): Promise<void> {
    if (!sensor.mqttEnabled || !sensor.mqttHost || !sensor.mqttPort || !sensor.ttnTopic) {
      logger.warn("Sensor missing required MQTT configuration", { sensorId: sensor.id });
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