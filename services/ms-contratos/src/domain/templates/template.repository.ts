import type {
  CreatePlantillaData,
  Page,
  PlantillaDetalle,
  PlantillaListado,
  PlantillaListQuery,
  UpdatePlantillaData,
} from './template.models';

export const PLANTILLA_REPOSITORY = Symbol('PLANTILLA_REPOSITORY');

export interface PlantillaRepository {
  list(query: PlantillaListQuery): Promise<Page<PlantillaListado>>;
  findById(id: string): Promise<PlantillaDetalle | null>;
  create(data: CreatePlantillaData): Promise<PlantillaDetalle>;
  update(id: string, data: UpdatePlantillaData): Promise<PlantillaDetalle | null>;
}
