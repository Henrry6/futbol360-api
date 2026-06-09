declare module "mongoose" {
  import { HydratedDocument } from "mongoose";
  import { EnumerateData } from "@/libs/enums";
  import { SmartQueryOptions } from "mongoose-smart-query";

  interface Model<
    TRawDocType,
    TQueryHelpers = {},
    TInstanceMethods = {},
    TVirtuals = {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    THydratedDocumentType = HydratedDocument<
      TRawDocType,
      TVirtuals & TInstanceMethods,
      TQueryHelpers
    >,
  > {
    getOptions(): Record<string, EnumerateData[]>;
    smartQuery(query: { [key: string]: any }): Promise<Array<any>>;
    smartQuery(
      query: { [key: string]: any },
      options?: SmartQueryOptions,
    ): Promise<{
      data: any[];
      pagination: { total: number; page: number; pages: number; limit: number };
    }>;
    smartCount(query: { [key: string]: any }): Promise<number>;
  }
}
