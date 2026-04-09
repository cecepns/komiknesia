import { Helmet } from "react-helmet-async";
import { Check, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { apiClient } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import qrisImage from "../assets/qris.png";
import { toast } from "react-toastify";

const premiumPackages = [
  {
    id: "monthly",
    name: "Paket 1 Bulan",
    duration: "30 Hari",
    price: "Rp20.000",
    highlight: false,
  },
  {
    id: "quarterly",
    name: "Paket 3 Bulan",
    duration: "90 Hari",
    price: "Rp60.000",
    highlight: true,
  },
  {
    id: "yearly",
    name: "Paket 1 Tahun",
    duration: "365 Hari",
    price: "Rp200.000",
    highlight: false,
  },
];

const benefits = ["Tanpa iklan", "Bonus point tambahan", "Fitur Premium"];

const Premium = () => {
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [form, setForm] = useState({
    username: user?.username || "",
    proofImage: null,
    preview: "",
    packageId: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return !!(form.packageId && form.username.trim() && form.proofImage);
  }, [form.packageId, form.username, form.proofImage]);

  const openOrderModal = (pkg) => {
    setSelectedPackage(pkg);
    setForm((prev) => ({
      ...prev,
      username: user?.username || prev.username || "",
      proofImage: null,
      preview: "",
      packageId: pkg.id,
    }));
  };

  const closeOrderModal = () => {
    setSelectedPackage(null);
  };

  const handleProofChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File bukti transfer harus berupa gambar.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5MB.");
      return;
    }

    const preview = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, proofImage: file, preview }));
  };

  const handleSubmitOrder = async (event) => {
    event.preventDefault();
    if (!selectedPackage) return;
    const selectedPackageData = premiumPackages.find((pkg) => pkg.id === form.packageId);
    if (!selectedPackageData) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("proof_image", form.proofImage);
      formData.append("username", form.username.trim());
      formData.append("package_id", selectedPackageData.id);
      formData.append("package_name", selectedPackageData.name);
      formData.append("package_price", selectedPackageData.price);
      await apiClient.createPremiumOrder(formData);
      toast.success("Order berhasil dikirim. Admin akan memverifikasi pembayaran Anda.");
      setForm((prev) => ({ ...prev, proofImage: null, preview: "" }));
      closeOrderModal();
    } catch (error) {
      toast.error(error?.message || "Gagal mengirim order premium.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white pt-5 md:pt-20 pb-4">
      <Helmet>
        <title>Premium | KomikNesia</title>
        <meta
          name="description"
          content="Upgrade ke KomikNesia Premium untuk membaca lebih nyaman tanpa iklan, bonus point tambahan, dan auto scroll manga."
        />
      </Helmet>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-amber-300/40 dark:border-amber-400/20 bg-gradient-to-b from-amber-100 via-white to-gray-100 dark:from-amber-500/10 dark:via-gray-900 dark:to-gray-950 p-6 md:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_50%)] dark:bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_50%)]" />

          <div className="relative text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 dark:border-amber-300/30 bg-amber-400/15 dark:bg-amber-400/10 px-4 py-1.5 text-xs font-semibold tracking-[0.2em] text-amber-700 dark:text-amber-300 uppercase">
              <Sparkles className="h-3.5 w-3.5" />
              Premium Membership
            </span>

            <h1 className="mt-5 text-4xl md:text-6xl font-extrabold leading-tight">
              Upgrade ke <span className="text-amber-600 dark:text-amber-400">VIP Premium</span>
            </h1>
            <p className="mt-4 text-sm md:text-base text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Baca manga lebih nyaman tanpa gangguan iklan, dapat bonus point tambahan, dan nikmati
              fitur menarik lainnya.
            </p>
          </div>

          <div className="relative mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            {premiumPackages.map((pkg) => (
              <article
                key={pkg.id}
                className={`rounded-2xl border p-5 md:p-6 shadow-lg ${
                  pkg.highlight
                    ? "border-amber-400 bg-gradient-to-b from-amber-100 to-amber-50 dark:from-amber-500/20 dark:to-gray-900 ring-1 ring-amber-300/60 dark:ring-amber-300/50"
                    : "border-gray-200 bg-white dark:border-white/15 dark:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{pkg.name}</p>
                    <p className="mt-3 text-4xl font-black">{pkg.price}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">untuk {pkg.duration}</p>
                  </div>
                  {pkg.highlight && (
                    <span className="rounded-full bg-amber-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-900">
                      Paling populer
                    </span>
                  )}
                </div>

                <div className="mt-6 border-t border-gray-200 dark:border-white/10 pt-4 space-y-2.5">
                  {benefits.map((benefit) => (
                    <div key={benefit} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {benefit}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => openOrderModal(pkg)}
                  className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
                    pkg.highlight
                      ? "bg-amber-400 text-gray-900 hover:bg-amber-300"
                      : "bg-gray-900 text-white hover:bg-gray-800 dark:bg-white/10 dark:hover:bg-white/20"
                  }`}
                >
                  Pilih Paket
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {selectedPackage && (
        <div className="fixed inset-0 z-[60] bg-black/60 p-4 overflow-y-auto">
          <div className="min-h-full flex items-start md:items-center justify-center py-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-xl">
            <div className="p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Form Pembelian Premium</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Paket: {selectedPackage.name} ({selectedPackage.price})
                </p>
              </div>
              <button
                type="button"
                onClick={closeOrderModal}
                className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-sm"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-5 space-y-4">
              <div className="rounded-xl border border-dashed border-amber-300 dark:border-amber-500/30 p-3 bg-amber-50/50 dark:bg-amber-500/5">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Transfer ke QRIS KomikNesia, lalu upload bukti transfer Anda di bawah ini.
                </p>
                <div className="mt-3">
                  <img
                    src={qrisImage}
                    alt="QRIS KomikNesia"
                    className="w-full max-w-xs mx-auto rounded-lg border border-amber-200 dark:border-amber-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Username akun</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="w-full h-11 rounded-lg border border-gray-200 dark:border-white/20 px-3 bg-white dark:bg-gray-950"
                  placeholder="Masukkan username akun"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Bukti transfer (gambar)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProofChange}
                  className="w-full text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Paket dibeli</label>
                <select
                  value={form.packageId}
                  onChange={(e) => setForm((prev) => ({ ...prev, packageId: e.target.value }))}
                  className="w-full h-11 rounded-lg border border-gray-200 dark:border-white/20 px-3 bg-white dark:bg-gray-950"
                  required
                >
                  {premiumPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} - {pkg.price}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="w-full h-11 rounded-xl bg-amber-400 text-gray-900 font-bold disabled:opacity-60"
              >
                {submitting ? "Mengirim..." : "Kirim Order Premium"}
              </button>
            </form>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Premium;
