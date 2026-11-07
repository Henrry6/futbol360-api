import { FastifyError } from "@/libs/utils";
import { buildImageUrl, deleteImage, uploadImage } from "./cloudinary";

// libs/imageController.ts
export const imageController = (Model: any, field: string, folder: string) => ({
  uploadImage: async (req: any, reply: any) => {
    const doc = await Model.findOne({
      _id: req.params.id,
      league: req.payload.league,
    });
    if (!doc) throw new FastifyError("No se encontró el registro");
    const file = await req.file();
    if (!file) throw new FastifyError("No se envió ningún archivo", 400);
    if (doc[field]) await deleteImage(doc[field]);
    const result = await uploadImage(await file.toBuffer(), folder);
    doc[field] = result.publicId;
    await doc.save();
    reply.send({ publicId: doc[field], url: buildImageUrl(doc[field]) });
  },
  getImage: async (req: any, reply: any) => {
    const doc = await Model.findOne(
      { _id: req.params.id, league: req.payload.league },
      { [field]: 1 },
    ).lean();
    if (!doc) throw new FastifyError("No se encontró el registro");
    reply.send({ publicId: doc[field], url: buildImageUrl(doc[field]) });
  },
  deleteImage: async (req: any, reply: any) => {
    const doc = await Model.findOne({
      _id: req.params.id,
      league: req.payload.league,
    });
    if (!doc) throw new FastifyError("No se encontró el registro");
    if (doc[field]) {
      await deleteImage(doc[field]);
      doc[field] = undefined;
      await doc.save();
    }
    reply.send({ success: true });
  },
});
