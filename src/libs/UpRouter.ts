import { deepmerge, FastifyError, getMovimiento, Movement } from "@/libs/utils";
import {
  ClientSession,
  HydratedDocument,
  Model as MongooseModel,
  Types,
} from "mongoose";
import {
  FastifyInstance,
  FastifyRequest,
  FastifySchema,
  RouteHandlerMethod,
} from "fastify";

export type UpRequest = {
  Querystring: {
    page?: string;
    sort?: string;
    fields?: string;
    q?: string;
    // campos para filtros
    league?: string | Types.ObjectId;
    _id?: string;
  };
  Params: {
    id?: string;
  };
  Body: {
    __v?: number;
    _id?: Types.ObjectId;
    league?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdBy?: Types.ObjectId;
    _movements?: Partial<Movement>[];
    // campos de configuración
    guardarComoBorrador?: boolean;
  };
};

const getUserIds = (request: FastifyRequest) => ({
  user: request.payload.user,
  league: request.payload.league ? request.payload.league : undefined,
});

export function prepareRequest(
  request: FastifyRequest<UpRequest>,
  filter?: { league?: Types.ObjectId; [key: string]: any },
) {
  const payload = request.payload;
  if (["GET"].includes(request.method)) {
    if (payload?.league) {
      request.query.league = payload.league.toString();
    }
    if (request.params.id) request.query._id = request.params.id;
  }

  if (["POST", "PUT"].includes(request.method)) {
    if (!request.body) {
      throw new FastifyError("No se proporcionó los datos", 400);
    } else {
      delete request.body.__v;
      if (request.payload?.league) {
        request.body.league = request.payload.league;
      }
      request.body.updatedBy = new Types.ObjectId(request.payload.user);
      if (request.method.includes("POST")) {
        request.body.createdBy = request.payload.user;
        request.body.updatedBy = request.payload.user;
      } else if (request.method.includes("PUT")) {
        request.body.updatedBy = request.payload.user;
      }
    }
  }
  if (filter && request.payload?.league) filter.league = request.payload.league;

  return request;
}

interface RouterOptions {
  Model: any & {
    createDocument?: (
      body: any,
      args?: {
        session?: ClientSession;
        user?: Types.ObjectId;
        league?: Types.ObjectId;
        guardarComoBorrador?: boolean;
      },
    ) => Promise<any>;
    editDocument?: (
      body: any,
      args?: {
        session?: ClientSession;
        user?: Types.ObjectId;
        league?: Types.ObjectId;
        guardarComoBorrador?: boolean;
      },
    ) => Promise<any>;
    deleteDocument?: (
      filter: Record<string, Types.ObjectId>,
      args: {
        session?: ClientSession;
        user?: Types.ObjectId;
        league?: Types.ObjectId;
      },
    ) => Promise<void>;
  };

  /**
   * Si es true crea el documento enviando una sessión.
   */
  crearConSesion?: boolean;

  /**
   * La lista de métodos que no deben ser creados.
   */
  exclude?: (
    | "get"
    | "postOne"
    | "getOne"
    | "putOne"
    | "delOne"
    | "getOptions"
  )[];

  /**
   * Se puede sobreescribir los controladores por defecto.
   */
  controllers?: {
    get?: RouteHandlerMethod;
    post?: RouteHandlerMethod;
    getOne?: RouteHandlerMethod;
    putOne?: RouteHandlerMethod;
    delOne?: RouteHandlerMethod;
  };

  schema?: {
    post?: FastifySchema;
    putOne?: FastifySchema;
  };

  /**
   * Funciones que se ejecutar antes después de utilizar el método `prepare`, se
   * puede utilizar para dar algun formato adicional.
   */
  pre?: {
    get?: (req: FastifyRequest) => void | Promise<void>;
    post?: (req: FastifyRequest) => void | Promise<void>;
    put?: (req: FastifyRequest) => void | Promise<void>;
  };
  post?: {
    get?: (data: any[], request: FastifyRequest) => void | Promise<void>;
    getOne?: (data: any, request: FastifyRequest) => void | Promise<void>;
  };
  campoFecha?: string | undefined;

  tieneAdjuntos?: true;

  /**
   * Un array con los paths que se pueden modificar directamente.
   */
  camposEdicionDirecta?: string[];
}

export default async function UpRouter(
  instance: FastifyInstance,
  options: RouterOptions,
): Promise<any> {
  // obtener todos
  if (!options.exclude?.includes("get")) {
    instance.get<UpRequest>(
      "",
      options.controllers?.get ||
        (async (request, reply) => {
          prepareRequest(request);
          console.log(request.query);
          if (options.pre?.get) await options.pre.get(request);
          const [data, total] = await Promise.all([
            options.Model.smartQuery(request.query),
            options.Model.smartCount(request.query),
          ]);
          if (options.post?.get) await options.post.get(data, request);
          reply.send({
            page: parseInt(request.query.page || "1"),
            total,
            data,
          });
        }),
    );
  }

  // obtener uno
  if (!options.exclude?.includes("getOne")) {
    instance.get<UpRequest>(
      "/:id",
      options.controllers?.getOne ||
        (async (request, reply) => {
          prepareRequest(request);
          const [documento] = await options.Model.smartQuery(request.query);
          if (!documento)
            throw new FastifyError("No se encontró el recurso", 404);
          if (options.post?.getOne)
            await options.post.getOne(documento, request);
          reply.send(documento);
        }),
    );
  }
  // crear
  if (!options.exclude?.includes("postOne")) {
    instance.post<UpRequest>("", {
      schema: options.schema?.post,
      handler:
        options.controllers?.post ||
        (async (request, reply) => {
          let session: ClientSession | undefined;
          try {
            prepareRequest(request);
            if (options.pre?.post) await options.pre.post(request);
            request.body._movements = [
              await getMovimiento({ type: "created", ...getUserIds(request) }),
            ];
            let documento: any;
            if (options.crearConSesion) {
              session = await options.Model.startSession();
              await session?.withTransaction(async () => {
                if (options.Model.createDocument) {
                  documento = await options.Model.createDocument(request.body, {
                    session,
                    user: request.payload.user,
                    league: request.payload.league,
                    guardarComoBorrador: request.body.guardarComoBorrador,
                  });
                } else {
                  documento = new options.Model(request.body);
                  documento.$session(session);
                  await documento.save();
                }
              });
            } else {
              if (options.Model.createDocument) {
                documento = await options.Model.createDocument(request.body, {
                  guardarComoBorrador: request.body.guardarComoBorrador,
                  league: request.payload.league,
                  user: request.payload.user,
                });
              } else {
                documento = new options.Model(request.body);
                await documento.save();
              }
            }
            reply.send(documento);
          } catch (err) {
            await session?.endSession();
            throw err;
          } finally {
            await session?.endSession();
          }
        }),
    });
  }

  // editar uno
  if (!options.exclude?.includes("putOne")) {
    instance.put<UpRequest>("/:id", {
      schema: options.schema?.putOne,
      handler:
        options.controllers?.putOne ||
        (async (request, reply) => {
          const filter = { _id: request.params.id };
          prepareRequest(request, filter);
          if (options.pre?.put) await options.pre.put(request);
          let documento: HydratedDocument<any>;

          if (options.crearConSesion) {
            const session = await options.Model.startSession();
            try {
              await session.withTransaction(async () => {
                if (options.Model.editDocument) {
                  request.body._id = new Types.ObjectId(request.params.id);
                  documento = await options.Model.editDocument(request.body, {
                    session,
                    user: request.payload.user,
                    league: request.payload.league,
                  });
                } else {
                  throw new Error("Método de edición no implementado");
                }
              });
              await session.endSession();
            } catch (err) {
              await session.endSession();
              throw err;
            }
          } else {
            if (options.Model.editDocument) {
              request.body._id = new Types.ObjectId(request.params.id);
              documento = await options.Model.editDocument(request.body, {
                guardarComoBorrador: request.body.guardarComoBorrador,
                user: request.payload.user,
                league: request.payload.league,
              });
              if (documento.isModified()) {
                documento._movements?.push(
                  (await getMovimiento({
                    type: "edit",
                    ...getUserIds(request),
                  })) as never,
                );
                await documento.save();
              }
            } else {
              documento = await options.Model.findOne(filter);
              if (!documento)
                throw new FastifyError(
                  "No se encontró documento a editar",
                  404,
                );
              documento.$locals.docOriginal = documento.toObject();
              documento.set(deepmerge(documento.toObject(), request.body));
              if (documento.isModified()) {
                documento._movements?.push(
                  (await getMovimiento({
                    type: "edit",
                    ...getUserIds(request),
                  })) as never,
                );
                await documento.save();
              }
            }
          }
          reply.send(documento);
        }),
    });
  }

  // eliminar uno
  if (!options.exclude?.includes("delOne")) {
    instance.delete<UpRequest>(
      "/:id",
      options.controllers?.delOne ||
        (async (request, reply) => {
          const session = await options.Model.startSession();
          try {
            await session.withTransaction(async () => {
              const filter: Record<string, Types.ObjectId> = {
                _id: new Types.ObjectId(request.params.id),
              };
              prepareRequest(request, filter);
              if (options.Model.deleteDocument) {
                await options.Model.deleteDocument(filter, {
                  session,
                  user: request.payload.user,
                  league: request.payload.league,
                });
              } else {
                const documento =
                  await options.Model.findOne(filter).session(session);
                if (!documento)
                  throw new FastifyError(
                    "No se encontró el documento a eliminar",
                    404,
                  );
                await documento.deleteOne({ session });
              }
              reply.send("success");
            });
            await session.endSession();
          } catch (err) {
            await session.endSession();
            throw err;
          }
        }),
    );
  }

  // get-options
  if (!options.exclude?.includes("getOptions")) {
    instance.get("/get-options", () => {
      return options.Model.getOptions?.() || {};
    });
  }
}
