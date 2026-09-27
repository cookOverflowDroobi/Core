import { Users } from "lucide-react";
import { useOnVisible } from "@/hooks";
import { useUserList } from "@/lib/queries";
import { Dialog } from "../ui/Dialog";
import { EmptyState, Skeleton, Spinner } from "../ui/misc";
import { UserRow } from "./UserRow";

export function UserListDialog({
  username,
  kind,
  onClose,
}: {
  username: string;
  kind: "followers" | "following" | null;
  onClose: () => void;
}) {
  const query = useUserList(username, kind ?? "followers", kind !== null);
  const sentinel = useOnVisible<HTMLDivElement>(() => query.fetchNextPage(), !!query.hasNextPage);
  const users = query.data?.pages.flatMap((p) => p.results) ?? [];

  return (
    <Dialog open={kind !== null} onClose={onClose} title={kind === "following" ? "Following" : "Followers"}>
      <div className="min-h-40 p-5">
        {query.isPending ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : users.length ? (
          <ul className="space-y-4">
            {users.map((user) => (
              <li key={user.id}>
                <UserRow user={user} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Users} title={kind === "following" ? "Not following anyone yet" : "No followers yet"} />
        )}
        <div ref={sentinel}>{query.isFetchingNextPage && <Spinner className="w-full py-3" />}</div>
      </div>
    </Dialog>
  );
}
