import matter from 'gray-matter';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

import {type EmbedField, Message, MessageEmbed} from 'discord.js';
import {readdirSync, readFileSync} from "fs";

interface Tag {
    name: string;
    aliases?: string[];
    title?: string;
    color?: number;
    content: string;
    image?: string;
    fields?: EmbedField[];
}

const TAG_DIR = join(process.cwd(), 'tags');

export const getTags = async (): Promise<Tag[]> => {
    const filenames = await readdir(TAG_DIR);
    const tags: Tag[] = [];

    for (const _file of filenames) {
        const file = join(TAG_DIR, _file);
        const { data, content } = matter(await readFile(file));

        tags.push({
            ...data,
            name: _file.replace('.md', ''),
            content: content.trim(),
            color: data.color || undefined,
        });
    }

    return tags;
};

export const tagCommand = async (event: Message) => {
    const tagName = event.content.split('!!')[1];

    const tags = await getTags();

    const tag = tags.find(
        (tag) => tag.name === tagName || tag.aliases?.includes(tagName)
    );

    if (!tag) return;

    const embed = new MessageEmbed()
        .setTitle(tag.title ?? tag.name)
        .setDescription(tag.content);
    if (tag.color) embed.setColor(tag.color);
    if (tag.image) embed.setImage(tag.image);
    if (tag.fields) embed.setFields(tag.fields);

    await event.channel.send({
        embeds: [embed],
    });
};

export const getTagsSync = (): Tag[] => {
    const filenames = readdirSync(TAG_DIR);
    const tags: Tag[] = [];

    for (const _file of filenames) {
        const file = join(TAG_DIR, _file);
        const { data, content } = matter(readFileSync(file));

        tags.push({
            ...data,
            name: _file.replace('.md', ''),
            content: content.trim(),
            color: data.color || undefined,
        });
    }

    return tags;
};
