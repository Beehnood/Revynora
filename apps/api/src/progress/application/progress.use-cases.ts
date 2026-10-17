import type { ProgressReader } from "../domain/progress";
export class GetProgress {
  constructor(private readonly reader: ProgressReader) {}
  execute(userId: string) {
    return this.reader.read(userId);
  }
}
