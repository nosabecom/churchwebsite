import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const newsletters = defineCollection({
    loader: glob({ base: "./src/content/newsletters", pattern: "**/*.{md,mdx}" }),
    schema: z.object({
        title: z.string().min(1),
        publishedAt: z.coerce.date(),
        excerpt: z.string().min(1),
        issue: z.number().int().positive().optional(),
        image: z.string().min(1).optional(),
        imageAlt: z.string().default(""),
        link: z.string().min(1).optional(),
        draft: z.boolean().default(false),
    }),
});

export const collections = { newsletters };
