import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

const SCRIPT_ID = "komiknesia-mbuh-redirect-script";
const SCRIPT_SRC = "https://mbuh.my.id/siap/1770790072377-komiknesia.js";

/**
 * Script redirect/iklan mbuh — tidak dimuat untuk user premium (membership aktif).
 */
export default function MbuhRedirectScript() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return undefined;

    if (user?.membership_active) {
      document.getElementById(SCRIPT_ID)?.remove();
      return undefined;
    }

    if (document.getElementById(SCRIPT_ID)) return undefined;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    // Script mbuh mendengarkan DOMContentLoaded. Kalau script disuntik setelah halaman
    // sudah load (SPA), event itu tidak pernah terjadi lagi — harus dipicu sintetis
    // setelah eksekusi script selesai.
    script.onload = () => {
      document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
    };
    document.body.appendChild(script);

    return () => {
      document.getElementById(SCRIPT_ID)?.remove();
    };
  }, [loading, user?.membership_active]);

  return null;
}
