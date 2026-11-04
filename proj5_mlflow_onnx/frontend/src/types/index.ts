export interface PredictionResponse {
  probability: number;
  class: number;
  model_name: string;
  accuracy: number;
}
