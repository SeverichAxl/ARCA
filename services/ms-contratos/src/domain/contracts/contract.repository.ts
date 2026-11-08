import type {
  ContratoCreado,
  ContratoDetalle,
  CreateContratoData,
} from './contract.models';

export const CONTRATO_REPOSITORY = Symbol('CONTRATO_REPOSITORY');

export interface ContratoRepository {
  create(data: CreateContratoData): Promise<ContratoCreado>;
  findById(id: string): Promise<ContratoDetalle | null>;
}
