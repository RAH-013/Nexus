import { Router } from "express";
import { Avatar, Style } from "@dicebear/core";
import definition from "@dicebear/styles/bottts-neutral.json" with { type: "json" };
import { toNodeHandler } from "better-auth/node";
import { auth } from "../lib/auth";

export const authRouter = Router();

authRouter.get("/get-avatar", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: getHeaders(req),
    });

    if (!session) {
      return res.status(401).json({
        message: "No authenticated session",
      });
    }

    if (session.user.image) {
      return res.redirect(session.user.image);
    }

    const style = new Style(definition);

    const avatar = new Avatar(style, {
      seed: session.user.name,
      size: 128,
    }).toString();

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "private, max-age=86400");

    return res.send(avatar);
  } catch (error) {
    console.error("Error al generar avatar:", error);

    return res.status(500).json({
      message: "No se pudo generar el avatar",
    });
  }
});

authRouter.all("/*splat", toNodeHandler(auth));

function getHeaders(req: import("express").Request) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }
  }

  return headers;
}
