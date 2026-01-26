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

    try {
      await this.refreshMqttConnections();
      this.initialized = true;
      setInterval(() => {
        this.refreshMqttConnections().catch((error) => {
          logger.error("Error refreshing MQTT connections", error);
        });
      }, 60000);
    } catch (error) {
      logger.error("Failed to initialize MQTT Service", error);
      throw error;
    }
  }

  async refreshMqttConnections(): Promise<void> {
    try {
      const mqttEnabledSensors = await storage.getAllMqttEnabledSensors();
      const validSensors = mqttEnabledSensors.filter((sensor) => {
        return !!(
          sensor.mqttEnabled &&
          sensor.isActive &&
          sensor.mqttHost &&
          sensor.mqttPort &&
          sensor.ttnTopic &&
          sensor.mqttUsername &&
          sensor.mqttPassword
        );
      });

      const sensorsByConnection = new Map<string, Sensor[]>();
      for (const sensor of validSensors) {
        const connectionKey = `${sensor.mqttHost}:${sensor.mqttPort}:${sensor.mqttUsername}`;
        if (!sensorsByConnection.has(connectionKey)) {
          sensorsByConnection.set(connectionKey, []);
        }
        sensorsByConnection.get(connectionKey)!.push(sensor);
      }

      for (const [connectionKey, sensors] of sensorsByConnection.entries()) {
        try {
          await this.ensureConnection(connectionKey, sensors);
        } catch (connectionError) {
          logger.error("Sensor group connection failed", connectionError);
        }
      }
    } catch (error) {
      logger.error("Error refreshing MQTT connections", error);
    }
  }

  private async ensureConnection(
    connectionKey: string,
    sensors: Sensor[],
  ): Promise<void> {
    const existingConnection = this.connections.get(connectionKey);

    if (existingConnection && existingConnection.client.connected) {
      existingConnection.sensors.clear();
      sensors.forEach((s) => existingConnection.sensors.add(s.id));
      const uniqueTopics = new Set<string>();
      sensors.forEach((s) => {
        if (s.ttnTopic) uniqueTopics.add(s.ttnTopic);
      });
      for (const topic of uniqueTopics) {
        existingConnection.client.subscribe(topic);
      }
      return;
    }

    const firstSensor = sensors[0];
    const client = mqtt.connect({
      host: firstSensor.mqttHost!,
      port: firstSensor.mqttPort!,
      username: firstSensor.mqttUsername,
      password: firstSensor.mqttPassword,
      protocol: "mqtts",
      reconnectPeriod: this.reconnectInterval,
      connectTimeout: 30000,
    });

    const connection: MqttConnection = {
      client,
      sensors: new Set(sensors.map((s) => s.id)),
      reconnectCount: 0,
    };

    this.connections.set(connectionKey, connection);

    client.on("connect", () => {
      logger.info(`Connected to ${firstSensor.mqttHost}`);
      sensors.forEach((s) => {
        if (s.ttnTopic) client.subscribe(s.ttnTopic);
      });
    });

    client.on("message", async (topic, message) => {
      try {
        const messageStr = message.toString();
        const fullMessageData = JSON.parse(messageStr);
        const messageData =
          fullMessageData.uplink_message?.decoded_payload || fullMessageData;

        const matchingSensors = sensors.filter((s) => s.ttnTopic === topic);
        for (const sensor of matchingSensors) {
          await this.processSensorMessage(sensor, messageData);
        }
      } catch (error) {
        logger.error("Error in message handler", error);
      }
    });
  }

  private async processSensorMessage(
    sensor: Sensor,
    messageData: any,
  ): Promise<void> {
    try {
      const field = sensor.jsonFields?.split(",")[0].trim();
      if (!field) return;

      const value = this.extractNestedValue(messageData, field);
      if (value === undefined) return;

      const readingValue = value.toString();
      const numericValue = Number(value);
      const timestamp = messageData.timestamp
        ? new Date(messageData.timestamp)
        : new Date();

      await storage.createSensorReading({
        sensorId: sensor.id,
        value: readingValue,
        timestamp,
        isSimulated: false,
      });

      // --- Alertas Preventivas ---
      const min = sensor.validationMin ? Number(sensor.validationMin) : null;
      const max = sensor.validationMax ? Number(sensor.validationMax) : null;

      if (min !== null && numericValue < min) {
        await storage.createAlert({
          organizationId: sensor.organizationId,
          sensorId: sensor.id,
          zoneId: sensor.zoneId,
          type: "min_breach",
          value: readingValue,
          threshold: sensor.validationMin!.toString(),
          isRead: false,
        });
      } else if (max !== null && numericValue > max) {
        await storage.createAlert({
          organizationId: sensor.organizationId,
          sensorId: sensor.id,
          zoneId: sensor.zoneId,
          type: "max_breach",
          value: readingValue,
          threshold: sensor.validationMax!.toString(),
          isRead: false,
        });
      }
    } catch (error) {
      logger.error(`Error processing message for sensor ${sensor.id}`, error);
    }
  }

  private extractNestedValue(obj: any, path: string): any {
    const segments = path.split(".");
    let current = obj;
    for (const key of segments) {
      if (current && current[key] !== undefined) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    return current;
  }

  async shutdown(): Promise<void> {
    for (const [key, connection] of this.connections.entries()) {
      connection.client.end();
    }
    this.connections.clear();
    this.initialized = false;
  }

  async forceRefresh(): Promise<void> {
    await this.refreshMqttConnections();
  }
}

export const mqttService = new MqttService();
