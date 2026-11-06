export interface SchemaError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  params: Record<string, unknown>;
  message?: string;
}

export interface SchemaValidateFunction {
  (data: unknown): boolean;
  errors?: SchemaError[] | null;
}

export declare const validate: SchemaValidateFunction;
export default validate;
