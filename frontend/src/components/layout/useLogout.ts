import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";

export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    try {
      await api("/auth/logout/", { method: "POST" });
    } catch (error) {
      toast.error(errorMessage(error));
      return;
    }
    qc.setQueryData(keys.me, null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" && q.queryKey[0] !== "stats" });
    navigate("/login", { replace: true });
    toast.success("Signed out. See you soon!");
  };
}
