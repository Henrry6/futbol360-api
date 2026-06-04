import { FastifyInstance } from "fastify";

export function prepareRequest(request: any) {
  const payload = request.user;

  if (request.method === "POST" || request.method === "PUT") {
    if (!request.body) {
      throw new Error("No se proporcionaron datos");
    }
    delete request.body.__v;
    if (payload?.company) {
      request.body.company = payload.company;
    }
    request.body.updatedBy = payload.user;
    if (request.method === "POST") {
      request.body.createdBy = payload.user;
    }
  }

  return request;
}

export function createCrudRoutes(app: FastifyInstance, model: any) {
  app.get("/", async (request) => {
    const company = (request.user as any)?.company;

    return model.find({
      company,
    });
  });

  app.get("/:id", async (request: any) => {
    return model.findById(request.params.id);
  });

  app.post("/", async (request: any) => {
    prepareRequest(request);

    if (model.createDocument) {
      return model.createDocument(request.body, {
        user: request.user,
      });
    }

    return model.create(request.body);
  });

  app.put("/:id", async (request: any) => {
    prepareRequest(request);

    if (model.updateDocument) {
      return model.updateDocument(request.params.id, request.body, {
        user: request.user,
      });
    }

    return model.findByIdAndUpdate(request.params.id, request.body, {
      new: true,
    });
  });

  app.delete("/:id", async (request: any) => {
    return model.findByIdAndDelete(request.params.id);
  });
}
