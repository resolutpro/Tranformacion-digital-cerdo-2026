import crypto from "crypto";
import { storage } from "./storage";
import { blockchain } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

// 1. Funciones Criptográficas
const calculateHash = (
  index: number,
  previousHash: string,
  timestamp: string,
  data: any,
): string => {
  return crypto
    .createHash("sha256")
    .update(index + previousHash + timestamp + JSON.stringify(data))
    .digest("hex");
};

// 2. Clase Blockchain Manager
export class BlockchainService {
  // Crear un nuevo bloque (Minería)
  static async createBlock(loteId: number, actionType: string, data: any) {
    // Obtener el último bloque
    const lastBlock = await storage
      .select()
      .from(blockchain)
      .orderBy(desc(blockchain.index))
      .limit(1);

    const index = lastBlock.length > 0 ? lastBlock[0].index + 1 : 0;
    const previousHash = lastBlock.length > 0 ? lastBlock[0].hash : "0"; // Bloque Génesis
    const timestamp = new Date().toISOString();

    const hash = calculateHash(index, previousHash, timestamp, data);

    // Guardar en BD
    await storage.insert(blockchain).values({
      index,
      timestamp,
      actionType,
      data,
      previousHash,
      hash,
      loteId,
      isValid: true,
    });

    return hash;
  }

  // Verificar Integridad (Auditoría)
  static async verifyChain(loteId: number) {
    const chain = await storage
      .select()
      .from(blockchain)
      .where(eq(blockchain.loteId, loteId))
      .orderBy(blockchain.index);

    for (let i = 1; i < chain.length; i++) {
      const current = chain[i];
      const previous = chain[i - 1];

      // 1. ¿El hash anterior coincide?
      if (current.previousHash !== previous.hash) return false;

      // 2. ¿El hash actual es válido? (Si alguien cambió los datos en la BD, esto fallará)
      const recalculatedHash = calculateHash(
        current.index,
        current.previousHash,
        current.timestamp,
        current.data,
      );
      if (current.hash !== recalculatedHash) return false;
    }
    return true;
  }
}

// 3. Smart Contracts (Reglas de Negocio Automatizadas)
export class SmartContracts {
  // Contrato: Verificación de Peso en Secadero
  static async certifyWeight(loteId: number, weight: number) {
    const MIN_WEIGHT_BELLOTA = 140; // kg

    // Regla del contrato
    const status =
      weight >= MIN_WEIGHT_BELLOTA
        ? "CERTIFICADO_PREMIUM"
        : "CERTIFICADO_ESTANDAR";

    // Ejecución automática en Blockchain
    await BlockchainService.createBlock(loteId, "SMART_CONTRACT_WEIGHT", {
      weight,
      status,
      contract: "VerificationProtocol_v1",
    });

    return status;
  }

  // Contrato: Validación de Calidad por IA (Integración)
  static async certifyQualityAI(loteId: number, score: number) {
    if (score < 50) throw new Error("Calidad insuficiente para certificación");

    const certificateId = crypto.randomUUID();

    await BlockchainService.createBlock(loteId, "SMART_CONTRACT_QUALITY_AI", {
      score,
      certificateId,
      issuedBy: "AI_MODEL_V2",
    });

    return certificateId;
  }
}
