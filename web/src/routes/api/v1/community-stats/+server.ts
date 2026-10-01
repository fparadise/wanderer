import { json, type RequestEvent } from "@sveltejs/kit";

export async function GET(event: RequestEvent) {
    try {
        let usersCount = 0;
        try {
            // Count registered local actors from PocketBase
            const actors = await event.locals.pb.collection("activitypub_actors").getList(1, 1, {
                filter: "is_local=1",
            });
            usersCount = actors.totalItems;
        } catch (err) {
            try {
                const usersAnon = await event.locals.pb.collection("users_anonymous").getList(1, 1);
                usersCount = usersAnon.totalItems;
            } catch {
                usersCount = 0;
            }
        }
        return json({ usersCount });
    } catch {
        return json({ usersCount: 0 });
    }
}
