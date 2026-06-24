import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Building2,
  CircleDollarSign,
  Download,
  FileText,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
  MonitorUp,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";
import { warrantyText } from "./data";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import {
  calculateArea,
  calculatePanelValue,
  calculatePixelLoad,
  calculateQuoteTotal,
  detectFormat,
  formatBRL,
  normalizeDocument,
  similarName,
  suggestProcessor,
} from "./calculations";
import { useBorealStore } from "./store";
import type { Category, Client, Partner, Product, Quote, QuoteStatus, Role } from "./types";

const quoteSchema = z.object({
  name: z.string().min(3),
  document: z.string().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const nav = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["new", "Nova Cotação", Plus],
  ["catalog", "Catálogo Boreal", BookOpen],
  ["quotes", "Cotações", FileText],
  ["clients", "Clientes", Users],
  ["partners", "Parceiros", Building2],
  ["settings", "Configurações", Settings],
] as const;

const borealLogoPath = "/assets/boreal-logo.png";
const borealPdfCoverPath = "/assets/boreal-pdf-cover.png";
const borealAboutSlidePath = "/assets/boreal-slide-about.png";
const borealExpertiseSlidePath = "/assets/boreal-slide-expertise.png";

type Page = (typeof nav)[number][0];

type Draft = {
  name: string;
  document: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  projectName: string;
  installationSite: string;
  notes: string;
  category: Category;
  productId: string;
  width: number;
  height: number;
  includeStructure: boolean;
  includeInstallation: boolean;
  includeProcessor: boolean;
  includeFreight: boolean;
  includeTechnicalVisit: boolean;
  includeExtendedWarranty: boolean;
  processorCost: number;
  freightCost: number;
  technicalVisitCost: number;
  extendedWarrantyCost: number;
  marginPercent: number;
  discountPercent: number;
  productImageDataUrl: string;
  screens: Array<{ id: string; productId: string; width: number; height: number; label: string }>;
};

const initialDraft: Draft = {
  name: "",
  document: "",
  phone: "",
  email: "",
  city: "Cuiabá",
  state: "MT",
  projectName: "",
  installationSite: "",
  notes: "",
  category: "indoor",
  productId: "cob-p15",
  width: 3,
  height: 1.35,
  includeStructure: true,
  includeInstallation: true,
  includeProcessor: true,
  includeFreight: false,
  includeTechnicalVisit: false,
  includeExtendedWarranty: false,
  processorCost: 0,
  freightCost: 0,
  technicalVisitCost: 1200,
  extendedWarrantyCost: 2500,
  marginPercent: 12,
  discountPercent: 0,
  productImageDataUrl: "",
  screens: [],
};

const statusLabels: Record<QuoteStatus, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  negotiation: "Em negociação",
  approved: "Aprovada",
  lost: "Perdida",
  cancelled: "Cancelada",
  technical_validation: "Validação técnica",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Logo() {
  return (
    <div className="flex items-center">
      <img className="h-14 w-auto max-w-[220px] object-contain" src={borealLogoPath} alt="Boreal" />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "cyan",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "cyan" | "violet" | "blue";
}) {
  const tones = {
    cyan: "text-cyan-200 bg-cyan-300/10 border-cyan-300/20",
    violet: "text-violet-200 bg-violet-300/10 border-violet-300/20",
    blue: "text-blue-200 bg-blue-300/10 border-blue-300/20",
  };
  return (
    <div className="neon-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <strong className="mt-2 block text-2xl text-white">{value}</strong>
        </div>
        <div className={cx("rounded-md border p-2", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  return <span className="badge">{statusLabels[status]}</span>;
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="label">{label}</span>
      <input className="field" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="label">{label}</span>
      <textarea className="field min-h-24 resize-y py-3" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function loadImageDataUrl(src: string) {
  const response = await fetch(src);
  const blob = await response.blob();
  return readImageFile(new File([blob], "boreal-logo.png", { type: blob.type || "image/png" }));
}

function getImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = src;
  });
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className={cx("flex h-11 items-center justify-between rounded-md border px-3 text-sm", checked ? "border-cyan-300/50 bg-cyan-300/10 text-white" : "border-white/10 bg-white/5 text-slate-300")}
      type="button"
      onClick={() => onChange(!checked)}
    >
      {label}
      <span className={cx("h-5 w-9 rounded-full p-0.5 transition", checked ? "bg-cyan-300" : "bg-slate-700")}>
        <span className={cx("block h-4 w-4 rounded-full bg-slate-950 transition", checked && "translate-x-4")} />
      </span>
    </button>
  );
}

function useQuoteMath(draft: Draft) {
  const products = useBorealStore((state) => state.products);
  return useMemo(() => {
    const product = products.find((item) => item.id === draft.productId) ?? products[0];
    const area = calculateArea(draft.width, draft.height);
    const panelValue = calculatePanelValue(area, product.pricePerSqm);
    const formatType = detectFormat(draft.width, draft.height);
    const pixelLoad = calculatePixelLoad(draft.width, draft.height, product.pixelPitchMm);
    const processor = suggestProcessor(pixelLoad.requiredPorts);
    const totals = calculateQuoteTotal({
      area,
      pricePerSqm: product.pricePerSqm,
      category: product.category,
      includeStructure: draft.includeStructure,
      includeInstallation: draft.includeInstallation,
      includeProcessor: draft.includeProcessor,
      includeFreight: draft.includeFreight,
      includeTechnicalVisit: draft.includeTechnicalVisit,
      includeExtendedWarranty: draft.includeExtendedWarranty,
      processorCost: draft.processorCost,
      freightCost: draft.freightCost,
      technicalVisitCost: draft.technicalVisitCost,
      extendedWarrantyCost: draft.extendedWarrantyCost,
      marginPercent: draft.marginPercent,
      discountPercent: draft.discountPercent,
    });
    return { product, area, panelValue, formatType, pixelLoad, processor, totals };
  }, [draft]);
}

function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("parceiro@boreal.com.br");
  const [password, setPassword] = useState("boreal-demo");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    setMessage("");
    try {
      await onLogin(email, password);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar na plataforma.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="grid w-full max-w-5xl gap-8 md:grid-cols-[1.1fr_.9fr]">
        <div className="flex flex-col justify-between rounded-lg border border-cyan-300/20 bg-slate-950/50 p-8 shadow-neon">
          <Logo />
          <div className="mt-20 max-w-xl">
            <span className="badge">Parceiros autorizados Boreal</span>
            <h1 className="mt-5 text-4xl font-black leading-tight text-white md:text-6xl">Cotação técnica de LED em minutos.</h1>
            <p className="mt-5 text-lg text-slate-300">
              Catálogo, cálculo por m², processadoras NovaStar, soluções LED Wave, margem interna e PDF comercial em uma experiência premium.
            </p>
          </div>
        </div>
        <form className="neon-card p-6" onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
          <div className="mb-8 flex items-center gap-3 text-cyan-100">
            <LockKeyhole className="h-5 w-5" />
            <h2 className="text-xl font-bold text-white">Acesso Boreal Quote Pro</h2>
          </div>
          <div className="space-y-4">
            <Input label="E-mail" value={email} onChange={setEmail} />
            <Input label="Senha" value={password} type="password" onChange={setPassword} />
            <button className="btn-primary w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Entrando..." : "Entrar na plataforma"}
            </button>
          </div>
          {message && <p className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{message}</p>}
          <p className="mt-6 text-sm text-slate-400">
            {isSupabaseConfigured
              ? "Conectado ao Supabase. Use um usuário criado no Auth e vinculado à tabela profiles."
              : "Modo demo local. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para usar autenticação e banco reais."}
          </p>
        </form>
      </section>
    </main>
  );
}

function BorealLayout({ page, setPage, children, onLogout }: { page: Page; setPage: (page: Page) => void; children: ReactNode; onLogout: () => void }) {
  const profile = useBorealStore((state) => state.profile);
  const isRemoteReady = useBorealStore((state) => state.isRemoteReady);
  const isSyncing = useBorealStore((state) => state.isSyncing);
  const syncError = useBorealStore((state) => state.syncError);
  const visibleNav = profile?.role === "master_admin" ? nav : nav.filter(([id]) => id !== "partners" && id !== "settings");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-white/10 bg-slate-950/70 p-4 backdrop-blur-xl lg:min-h-screen lg:border-b-0 lg:border-r">
        <Logo />
        <nav className="mt-8 grid grid-cols-2 gap-2 lg:grid-cols-1">
          {visibleNav.map(([id, label, Icon]) => (
            <button key={id} className={cx("flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm transition", page === id ? "bg-cyan-300/10 text-cyan-100" : "text-slate-300 hover:bg-white/5 hover:text-white")} onClick={() => setPage(id)}>
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-8 rounded-lg border border-violet-300/20 bg-violet-300/10 p-4 text-sm text-violet-100">
          <strong>Perfil ativo</strong>
          <p className="mt-1 text-violet-100/80">{profile?.name ?? "Demo local"}</p>
          <p className="mt-1 text-violet-100/70">{profile?.role ?? "partner_admin"} · {isRemoteReady ? "Supabase ativo" : "dados locais"}</p>
          <button className="btn-secondary mt-4 h-9 w-full" onClick={onLogout}>Sair</button>
        </div>
      </aside>
      <main className="px-4 py-6 md:px-8 lg:px-10">
        {(isSyncing || syncError) && (
          <div className={cx("mb-4 rounded-lg border p-3 text-sm", syncError ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100")}>
            {syncError || "Sincronizando dados com o Supabase..."}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

function DashboardPage() {
  const quotes = useBorealStore((state) => state.quotes);
  const clients = useBorealStore((state) => state.clients);
  const products = useBorealStore((state) => state.products);
  const totalOpen = quotes.reduce((sum, quote) => {
    const math = calculateQuoteTotal({
      area: calculateArea(quote.width, quote.height),
      pricePerSqm: quote.product.pricePerSqm,
      category: quote.product.category,
      includeStructure: quote.includeStructure,
      includeInstallation: quote.includeInstallation,
      includeProcessor: quote.includeProcessor,
      includeFreight: quote.includeFreight,
      includeTechnicalVisit: quote.includeTechnicalVisit,
      includeExtendedWarranty: quote.includeExtendedWarranty,
      processorCost: quote.processorCost,
      freightCost: quote.freightCost,
      technicalVisitCost: quote.technicalVisitCost,
      extendedWarrantyCost: quote.extendedWarrantyCost,
      marginPercent: quote.marginPercent,
      discountPercent: quote.discountPercent,
    });
    return sum + math.total;
  }, 0);

  const chartData = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"].map((month, index) => ({
    month,
    quotes: index === 5 ? quotes.length : 0,
  }));
  const pieData = ["COB", "GOB", "SMD", "Outdoor"].map((name, index) => ({
    name,
    value: quotes.filter((quote) => quote.product.technology.includes(name)).length,
    color: ["#18e4ff", "#8b5cf6", "#3677ff", "#22d3ee"][index],
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Visão comercial, técnica e financeira das cotações Boreal." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Cotações criadas" value={String(quotes.length)} icon={FileText} />
        <MetricCard label="Em negociação" value={String(quotes.filter((quote) => quote.status === "negotiation").length)} icon={Gauge} tone="blue" />
        <MetricCard label="Valor em aberto" value={formatBRL(totalOpen)} icon={CircleDollarSign} tone="violet" />
        <MetricCard label="Clientes cadastrados" value={String(clients.length)} icon={Users} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_.8fr]">
        <div className="neon-card p-5">
          <h3 className="mb-4 font-bold text-white">Cotações por mês</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="quoteGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#18e4ff" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#18e4ff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.08)" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#061123", border: "1px solid rgba(24,228,255,.25)", borderRadius: 8 }} />
                <Area dataKey="quotes" stroke="#18e4ff" fill="url(#quoteGradient)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="neon-card p-5">
          <h3 className="mb-4 font-bold text-white">Valor por tecnologia</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={95} paddingAngle={4}>
                  {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#061123", border: "1px solid rgba(24,228,255,.25)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="neon-card p-5">
        <h3 className="mb-4 font-bold text-white">Produtos mais cotados</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={products.slice(0, 6).map((product) => ({ name: `${product.technology} ${product.pixelPitch}`, qtd: quotes.filter((quote) => quote.product.id === product.id).length }))}>
              <CartesianGrid stroke="rgba(255,255,255,.08)" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: "#061123", border: "1px solid rgba(24,228,255,.25)", borderRadius: 8 }} />
              <Bar dataKey="qtd" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="label">Boreal Quote Pro</p>
        <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-slate-300">{subtitle}</p>
      </div>
    </header>
  );
}

function DuplicateClientAlert({ draft }: { draft: Draft }) {
  const clients = useBorealStore((state) => state.clients);
  const sameDocument = clients.find((client) => normalizeDocument(client.document) && normalizeDocument(client.document) === normalizeDocument(draft.document));
  const nameLike = !sameDocument && draft.name ? clients.find((client) => similarName(draft.name, client.name)) : null;

  if (sameDocument) {
    return (
      <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-red-100">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5" />
          <p>Este cliente já possui registro comercial ativo na Boreal. Entre em contato com a Boreal para validação comercial.</p>
        </div>
      </div>
    );
  }
  if (nameLike) {
    return (
      <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-amber-100">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5" />
          <p>Encontramos um cliente com nome semelhante. Verifique antes de prosseguir.</p>
        </div>
      </div>
    );
  }
  return null;
}

function QuoteWizard({ editingQuote, onDone }: { editingQuote?: Quote | null; onDone?: () => void }) {
  const products = useBorealStore((state) => state.products);
  const initialFromQuote = editingQuote
    ? {
        ...initialDraft,
        name: editingQuote.client.name,
        document: editingQuote.client.document,
        phone: editingQuote.client.phone,
        email: editingQuote.client.email,
        city: editingQuote.client.city,
        state: editingQuote.client.state,
        projectName: editingQuote.client.projectName,
        installationSite: editingQuote.client.installationSite,
        notes: editingQuote.client.notes,
        category: editingQuote.product.category,
        productId: editingQuote.product.id,
        width: editingQuote.width,
        height: editingQuote.height,
        includeStructure: editingQuote.includeStructure,
        includeInstallation: editingQuote.includeInstallation,
        includeProcessor: editingQuote.includeProcessor,
        includeFreight: editingQuote.includeFreight,
        includeTechnicalVisit: editingQuote.includeTechnicalVisit,
        includeExtendedWarranty: editingQuote.includeExtendedWarranty,
        processorCost: editingQuote.processorCost,
        freightCost: editingQuote.freightCost,
        technicalVisitCost: editingQuote.technicalVisitCost,
        extendedWarrantyCost: editingQuote.extendedWarrantyCost,
        marginPercent: editingQuote.marginPercent,
        discountPercent: editingQuote.discountPercent,
        productImageDataUrl: editingQuote.productImageDataUrl ?? "",
        screens: editingQuote.screens?.map((screen) => ({ id: screen.id, productId: screen.product.id, width: screen.width, height: screen.height, label: screen.label })) ?? [],
      }
    : initialDraft;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(initialFromQuote);
  const [message, setMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const addClient = useBorealStore((state) => state.addClient);
  const addQuote = useBorealStore((state) => state.addQuote);
  const updateQuote = useBorealStore((state) => state.updateQuote);
  const saveQuote = useBorealStore((state) => state.saveQuote);
  const clients = useBorealStore((state) => state.clients);
  const profile = useBorealStore((state) => state.profile);
  const math = useQuoteMath(draft);
  const availableProducts = products.filter((product) => product.category === draft.category);
  const sameDocument = Boolean(draft.document) && clients.some((client) => client.id !== editingQuote?.client.id && normalizeDocument(client.document) && normalizeDocument(client.document) === normalizeDocument(draft.document));
  const validation = quoteSchema.safeParse({ name: draft.name, document: draft.document, width: draft.width, height: draft.height });

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function generateQuote() {
    if (!validation.success || sameDocument) {
      setMessage("Revise cliente, documento e medidas antes de gerar a cotação.");
      return;
    }

    setIsGenerating(true);

    const client: Client = {
      id: editingQuote?.client.id ?? crypto.randomUUID(),
      name: draft.name,
      document: draft.document,
      phone: draft.phone,
      email: draft.email,
      city: draft.city,
      state: draft.state,
      projectName: draft.projectName,
      installationSite: draft.installationSite,
      notes: draft.notes,
      partnerId: profile?.partner_id ?? "",
      createdBy: profile?.id ?? "",
    };
    const quote: Quote = {
      id: editingQuote?.id ?? crypto.randomUUID(),
      quoteNumber: editingQuote?.quoteNumber ?? `BOR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
      client,
      createdBy: editingQuote?.createdBy ?? profile?.id ?? "",
      product: math.product,
      width: draft.width,
      height: draft.height,
      screens: draft.screens.map((screen) => ({
        id: screen.id,
        product: products.find((product) => product.id === screen.productId) ?? math.product,
        width: screen.width,
        height: screen.height,
        label: screen.label,
      })),
      includeStructure: draft.includeStructure,
      includeInstallation: draft.includeInstallation,
      includeProcessor: draft.includeProcessor,
      includeFreight: draft.includeFreight,
      includeTechnicalVisit: draft.includeTechnicalVisit,
      includeExtendedWarranty: draft.includeExtendedWarranty,
      processorCost: draft.processorCost,
      freightCost: draft.freightCost,
      technicalVisitCost: draft.technicalVisitCost,
      extendedWarrantyCost: draft.extendedWarrantyCost,
      marginPercent: draft.marginPercent,
      discountPercent: draft.discountPercent,
      status: math.processor.note ? "technical_validation" : "sent",
      createdAt: new Date().toISOString().slice(0, 10),
      productImageDataUrl: draft.productImageDataUrl,
    };
    addClient(client);
    if (editingQuote) {
      updateQuote(quote);
    } else {
      addQuote(quote);
    }
    const result = await saveQuote(client, quote);
    setMessage(result.message);
    await exportQuotePdf(quote);
    onDone?.();
    setIsGenerating(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Nova Cotação" subtitle="Fluxo guiado para gerar propostas de painéis Boreal em menos de 2 minutos." />
      <div className="neon-card p-3">
        <div className="grid gap-2 md:grid-cols-7">
          {["Cliente", "Tipo", "Tecnologia", "Medida", "Processamento", "Serviços", "Revisão"].map((label, index) => (
            <button key={label} className={cx("rounded-md px-3 py-2 text-sm", step === index ? "bg-cyan-300 text-slate-950" : "bg-white/5 text-slate-300")} onClick={() => setStep(index)}>
              {index + 1}. {label}
            </button>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="neon-card grid gap-4 p-5">
            <Input label="Nome do cliente" value={draft.name} onChange={(value) => update("name", value)} />
            <Input label="CPF ou CNPJ" value={draft.document} onChange={(value) => update("document", value)} />
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Telefone" value={draft.phone} onChange={(value) => update("phone", value)} />
              <Input label="E-mail" value={draft.email} onChange={(value) => update("email", value)} />
              <Input label="Cidade" value={draft.city} onChange={(value) => update("city", value)} />
              <Input label="Estado" value={draft.state} onChange={(value) => update("state", value)} />
            </div>
            <Input label="Nome do projeto" value={draft.projectName} onChange={(value) => update("projectName", value)} />
            <Input label="Local de instalação" value={draft.installationSite} onChange={(value) => update("installationSite", value)} />
            <TextArea label="Observações internas" value={draft.notes} onChange={(value) => update("notes", value)} />
          </div>
          <div className="space-y-4">
            <DuplicateClientAlert draft={draft} />
            <WarrantyReliabilitySection compact />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 md:grid-cols-2">
          {(["indoor", "outdoor"] as Category[]).map((category) => (
            <button key={category} className={cx("neon-card p-8 text-left transition hover:border-cyan-300/50", draft.category === category && "border-cyan-300/70 bg-cyan-300/10")} onClick={() => {
              const nextProduct = products.find((product) => product.category === category)!;
              setDraft((current) => ({ ...current, category, productId: nextProduct.id }));
            }}>
              <MonitorUp className="mb-4 h-8 w-8 text-cyan-200" />
              <h2 className="text-2xl font-black capitalize text-white">{category}</h2>
              <p className="mt-2 text-slate-300">{category === "indoor" ? "COB, GOB e SMD para ambientes internos premium." : "Soluções SMD Outdoor para fachadas e comunicação externa."}</p>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {availableProducts.map((product) => (
            <ProductCatalogCard key={product.id} product={product} onQuote={() => {
              const firstFormat = product.formats[0];
              setDraft((current) => ({ ...current, productId: product.id, width: firstFormat?.width ?? current.width, height: firstFormat?.height ?? current.height }));
            }} selected={product.id === draft.productId} />
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
          <div className="neon-card grid gap-4 p-5">
            <h2 className="text-xl font-bold text-white">Medida da tela</h2>
            <div className="grid gap-3">
              {math.product.formats.map((format) => (
                <button key={`${format.width}-${format.height}`} className="btn-secondary justify-between" onClick={() => setDraft((current) => ({ ...current, width: format.width, height: format.height }))}>
                  Formato padrão
                  <span>{format.width.toFixed(2)} x {format.height.toFixed(2)} m</span>
                </button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Largura (m)" type="number" value={draft.width} onChange={(value) => update("width", Number(value))} />
              <Input label="Altura (m)" type="number" value={draft.height} onChange={(value) => update("height", Number(value))} />
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-white">Telas adicionais</h3>
                <button
                  className="btn-secondary h-9"
                  onClick={() => update("screens", [...draft.screens, { id: crypto.randomUUID(), productId: draft.productId, width: draft.width, height: draft.height, label: `Tela ${draft.screens.length + 2}` }])}
                >
                  Adicionar tela
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                {draft.screens.map((screen) => (
                  <div className="grid gap-3 rounded-md border border-white/10 p-3 md:grid-cols-[1fr_1fr_1fr_auto]" key={screen.id}>
                    <Input label="Nome" value={screen.label} onChange={(value) => update("screens", draft.screens.map((item) => item.id === screen.id ? { ...item, label: value } : item))} />
                    <Input label="Largura" type="number" value={screen.width} onChange={(value) => update("screens", draft.screens.map((item) => item.id === screen.id ? { ...item, width: Number(value) } : item))} />
                    <Input label="Altura" type="number" value={screen.height} onChange={(value) => update("screens", draft.screens.map((item) => item.id === screen.id ? { ...item, height: Number(value) } : item))} />
                    <button className="btn-secondary self-end" onClick={() => update("screens", draft.screens.filter((item) => item.id !== screen.id))}>Remover</button>
                    <label className="space-y-2 md:col-span-4">
                      <span className="label">Produto da tela</span>
                      <select className="field" value={screen.productId} onChange={(event) => update("screens", draft.screens.map((item) => item.id === screen.id ? { ...item, productId: event.target.value } : item))}>
                        {products.map((product) => <option key={product.id} value={product.id}>{product.technology} {product.pixelPitch}</option>)}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <QuoteTechnicalCards draft={draft} />
        </div>
      )}

      {step === 4 && <QuoteTechnicalCards draft={draft} processingOnly />}

      {step === 5 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_.9fr]">
          <div className="neon-card grid gap-3 p-5">
            <h2 className="text-xl font-bold text-white">Custos adicionais</h2>
            <Toggle label="Incluir estrutura" checked={draft.includeStructure} onChange={(value) => update("includeStructure", value)} />
            <Toggle label="Incluir instalação" checked={draft.includeInstallation} onChange={(value) => update("includeInstallation", value)} />
            <Toggle label="Incluir processadora" checked={draft.includeProcessor} onChange={(value) => update("includeProcessor", value)} />
            <Toggle label="Incluir frete" checked={draft.includeFreight} onChange={(value) => update("includeFreight", value)} />
            <Toggle label="Incluir visita técnica" checked={draft.includeTechnicalVisit} onChange={(value) => update("includeTechnicalVisit", value)} />
            <Toggle label="Incluir garantia estendida" checked={draft.includeExtendedWarranty} onChange={(value) => update("includeExtendedWarranty", value)} />
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Frete" type="number" value={draft.freightCost} onChange={(value) => update("freightCost", Number(value))} />
              <Input label="Processadora" type="number" value={draft.processorCost} onChange={(value) => update("processorCost", Number(value))} />
              <Input label="Visita técnica" type="number" value={draft.technicalVisitCost} onChange={(value) => update("technicalVisitCost", Number(value))} />
              <Input label="Garantia estendida" type="number" value={draft.extendedWarrantyCost} onChange={(value) => update("extendedWarrantyCost", Number(value))} />
              <Input label="Margem interna (%)" type="number" value={draft.marginPercent} onChange={(value) => update("marginPercent", Number(value))} />
              <Input label="Desconto (%)" type="number" value={draft.discountPercent} onChange={(value) => update("discountPercent", Number(value))} />
            </div>
          </div>
          <PriceCalculator draft={draft} showInternal />
        </div>
      )}

      {step === 6 && (
        <div className="grid gap-4 xl:grid-cols-[1fr_.8fr]">
          <QuoteSummary draft={draft} />
          <div className="space-y-4">
            <div className="neon-card p-5">
              <h3 className="font-bold text-white">Imagem para o PDF</h3>
              <p className="mt-2 text-sm text-slate-300">Envie uma imagem do produto, mockup ou local de instalação para destacar a proposta comercial.</p>
              <input
                className="mt-4 block w-full text-sm text-slate-300 file:mr-4 file:h-10 file:rounded-md file:border-0 file:bg-cyan-300 file:px-4 file:text-sm file:font-semibold file:text-slate-950"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void readImageFile(file).then((dataUrl) => update("productImageDataUrl", dataUrl));
                }}
              />
              {draft.productImageDataUrl && <img className="mt-4 max-h-56 w-full rounded-md object-cover" src={draft.productImageDataUrl} alt="Prévia do produto" />}
            </div>
            <PriceCalculator draft={draft} showInternal />
            {message && <div className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-4 text-cyan-100">{message}</div>}
            <button className="btn-primary w-full" onClick={() => void generateQuote()} disabled={isGenerating}>
              <Download className="h-4 w-4" />
              {isGenerating ? "Gerando..." : "Gerar cotação e PDF"}
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button className="btn-secondary" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Voltar</button>
        <button className="btn-primary" disabled={step === 6 || (step === 0 && sameDocument)} onClick={() => setStep((value) => Math.min(6, value + 1))}>Avançar</button>
      </div>
    </div>
  );
}

function QuoteTechnicalCards({ draft, processingOnly = false }: { draft: Draft; processingOnly?: boolean }) {
  const math = useQuoteMath(draft);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {!processingOnly && (
        <div className="neon-card p-5">
          <h3 className="font-bold text-white">Medidas</h3>
          <dl className="mt-4 grid gap-3 text-sm text-slate-300">
            <Info label="Largura" value={`${draft.width.toFixed(2)} m`} />
            <Info label="Altura" value={`${draft.height.toFixed(2)} m`} />
            <Info label="Área" value={`${math.area.toFixed(2)} m²`} />
            <Info label="Valor do painel" value={formatBRL(math.panelValue)} />
            <Info label="Proporção" value={(draft.width / draft.height).toFixed(2)} />
            <Info label="Formato" value={math.formatType} />
          </dl>
          {math.formatType === "16:9" && <Alert text="Esta medida está mais próxima do formato 16:9 do que do formato Ultrawide / Cinema." />}
        </div>
      )}
      <div className="neon-card p-5">
        <h3 className="font-bold text-white">Carga de pixels</h3>
        <dl className="mt-4 grid gap-3 text-sm text-slate-300">
          <Info label="Pixels largura" value={math.pixelLoad.pixelsWidth.toLocaleString("pt-BR")} />
          <Info label="Pixels altura" value={math.pixelLoad.pixelsHeight.toLocaleString("pt-BR")} />
          <Info label="Total de pixels" value={math.pixelLoad.totalPixels.toLocaleString("pt-BR")} />
          <Info label="Portas necessárias" value={String(math.pixelLoad.requiredPorts)} />
        </dl>
        {math.pixelLoad.totalPixels > 1300000 && <Alert text="Atenção: este painel possui alta carga de pixels. Verifique a processadora sugerida e a necessidade de validação técnica." />}
      </div>
      <div className="neon-card p-5">
        <h3 className="font-bold text-white">Processamento de vídeo</h3>
        <dl className="mt-4 grid gap-3 text-sm text-slate-300">
          <Info label="Marca" value={math.processor.brand} />
          <Info label="Modelo sugerido" value={math.processor.name} />
          <Info label="Portas disponíveis" value={String(math.processor.ports)} />
          <Info label="Portas necessárias" value={String(math.pixelLoad.requiredPorts)} />
          <Info label="Status" value={math.processor.note ? "Projeto especial" : "Compatível"} />
        </dl>
        {math.processor.note && <Alert text="Projeto especial: necessário dimensionamento técnico pela Boreal." />}
      </div>
      {math.product.category === "outdoor" && <Alert text="Projetos outdoor exigem validação de estrutura, ventilação, acesso técnico, fixação, drenagem e resistência climática." />}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-semibold text-white">{value}</dd>
    </div>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{text}</span>
      </div>
    </div>
  );
}

function PriceCalculator({ draft, showInternal = false }: { draft: Draft; showInternal?: boolean }) {
  const math = useQuoteMath(draft);
  return (
    <div className="neon-card p-5">
      <h3 className="font-bold text-white">Resumo financeiro</h3>
      <dl className="mt-4 grid gap-3 text-sm">
        <Info label="Painel de LED" value={formatBRL(math.totals.withMargin.panel)} />
        <Info label="Estrutura" value={formatBRL(math.totals.withMargin.structure)} />
        <Info label="Instalação" value={formatBRL(math.totals.withMargin.installation)} />
        <Info label="Processadora" value={formatBRL(math.totals.withMargin.processor)} />
        <Info label="Frete" value={formatBRL(math.totals.withMargin.freight)} />
        <Info label="Serviços técnicos" value={formatBRL(math.totals.withMargin.technicalVisit + math.totals.withMargin.extendedWarranty)} />
        <Info label="Desconto" value={formatBRL(math.totals.discountValue)} />
      </dl>
      <div className="mt-5 rounded-lg bg-cyan-300 p-4 text-slate-950">
        <span className="text-sm font-semibold">Total final</span>
        <strong className="block text-3xl">{formatBRL(math.totals.total)}</strong>
      </div>
      {showInternal && (
        <div className="mt-4 rounded-lg border border-violet-300/20 bg-violet-300/10 p-4 text-sm text-violet-100">
          <Info label="Valor base interno" value={formatBRL(Object.values(math.totals.base).reduce((sum, value) => sum + value, 0))} />
          <Info label="Margem aplicada" value={`${draft.marginPercent}%`} />
          <Info label="Lucro estimado" value={formatBRL(math.totals.internalMarginValue)} />
        </div>
      )}
    </div>
  );
}

function QuoteSummary({ draft }: { draft: Draft }) {
  const math = useQuoteMath(draft);
  const cards = [
    ["Cliente", `${draft.name || "Cliente não informado"} · ${draft.city}/${draft.state}`, draft.projectName || "Projeto sem nome"],
    ["Produto", `${math.product.technology} ${math.product.pixelPitch}`, `NovaStar · Gabinete ${math.product.cabinetSize ?? "sob projeto"}`],
    ["Medidas", `${draft.width.toFixed(2)} x ${draft.height.toFixed(2)} m`, `${math.area.toFixed(2)} m² · ${math.formatType}`],
    ["Carga de pixels", math.pixelLoad.totalPixels.toLocaleString("pt-BR"), `${math.pixelLoad.requiredPorts} portas necessárias`],
    ["Processadora", math.processor.name, `${math.processor.ports} portas disponíveis · ${math.processor.note ? "Validação técnica" : "Compatível"}`],
    ["Serviços", "Estrutura, instalação e adicionais", "Valores finais com margem interna aplicada"],
    ["Garantia e confiabilidade", "Até 100.000 horas", "Operação contínua · manutenção facilitada"],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map(([title, main, sub]) => (
        <div className="neon-card p-5" key={title}>
          <p className="label">{title}</p>
          <h3 className="mt-2 text-lg font-bold text-white">{main}</h3>
          <p className="mt-2 text-sm text-slate-300">{sub}</p>
        </div>
      ))}
    </div>
  );
}

function ProductCatalogCard({ product, onQuote, selected = false }: { product: Product; onQuote: () => void; selected?: boolean }) {
  const profile = useBorealStore((state) => state.profile);
  const upsertProduct = useBorealStore((state) => state.upsertProduct);
  return (
    <article className={cx("neon-card flex flex-col p-5", selected && "border-cyan-300/70 bg-cyan-300/10")}>
      {product.imageDataUrl && <img className="mb-4 h-40 w-full rounded-md object-cover" src={product.imageDataUrl} alt={`${product.technology} ${product.pixelPitch}`} />}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="badge">{product.application}</span>
          <h3 className="mt-4 text-2xl font-black text-white">{product.technology} {product.pixelPitch}</h3>
        </div>
        <ShieldCheck className="h-6 w-6 text-cyan-200" />
      </div>
      <dl className="mt-4 grid gap-2 text-sm text-slate-300">
        <Info label="Gabinete" value={product.cabinetSize ?? "Sob projeto"} />
        <Info label="Valor m²" value={formatBRL(product.pricePerSqm)} />
        <Info label="Vida útil" value="até 100.000 h" />
        <Info label="Processamento" value={product.processorSystem} />
      </dl>
      <p className="mt-4 flex-1 text-sm text-slate-300">{product.recommendedUse}</p>
      {profile?.role === "master_admin" && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="label">Imagem do produto</span>
            <input
              className="mt-2 block w-full text-xs text-slate-300 file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-cyan-300 file:px-3 file:text-xs file:font-semibold file:text-slate-950"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void readImageFile(file).then((imageDataUrl) => upsertProduct({ ...product, imageDataUrl }));
              }}
            />
          </label>
          {product.imageDataUrl && (
            <button className="btn-secondary h-9 w-full" onClick={() => void upsertProduct({ ...product, imageDataUrl: undefined })}>
              Remover imagem
            </button>
          )}
        </div>
      )}
      <div className="mt-5 flex gap-2">
        <button className="btn-primary flex-1" onClick={onQuote}>Criar cotação</button>
        <button className="btn-secondary" onClick={() => alert(product.technicalHighlights.concat(product.commercialDifferentials).join("\n"))}>Detalhes</button>
      </div>
    </article>
  );
}

function CatalogPage({ onQuote }: { onQuote: () => void }) {
  const [filter, setFilter] = useState<"all" | "indoor" | "outdoor">("all");
  const products = useBorealStore((state) => state.products);
  const visible = products.filter((product) => filter === "all" || product.category === filter);
  return (
    <div className="space-y-6">
      <PageHeader title="Catálogo Boreal" subtitle="Painéis LED Wave com processamento NovaStar, organizados por aplicação e tecnologia." />
      <div className="flex flex-wrap gap-2">
        {(["all", "indoor", "outdoor"] as const).map((id) => (
          <button key={id} className={cx("btn-secondary", filter === id && "border-cyan-300/70 bg-cyan-300/10")} onClick={() => setFilter(id)}>
            {id === "all" ? "Todos os modelos" : id === "indoor" ? "Indoor Ultrawide / Cinema" : "Outdoor"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((product) => <ProductCatalogCard key={product.id} product={product} onQuote={onQuote} />)}
      </div>
      <WarrantyReliabilitySection />
    </div>
  );
}

function WarrantyReliabilitySection({ compact = false }: { compact?: boolean }) {
  const items = ["Vida útil de até 100.000 horas", "Alta resistência", "Operação contínua", "Imagem estável", "Manutenção frontal", "Proteção conforme tecnologia", "Processamento NovaStar", "Solução LED Wave"];
  return (
    <section className="neon-card p-5">
      <div className="flex items-center gap-3">
        <BadgeCheck className="h-5 w-5 text-cyan-200" />
        <h2 className="text-xl font-bold text-white">Garantia, vida útil e confiabilidade Boreal</h2>
      </div>
      {!compact && <p className="mt-4 text-slate-300">{warrantyText}</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200" key={item}>{item}</span>)}
      </div>
    </section>
  );
}

function QuotesPage({ onEdit }: { onEdit: (quote: Quote) => void }) {
  const quotes = useBorealStore((state) => state.quotes);
  const deleteQuote = useBorealStore((state) => state.deleteQuote);
  const profile = useBorealStore((state) => state.profile);
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-6">
      <PageHeader title="Cotações" subtitle="Tabela operacional com status, valor, tecnologia, formato e processadora sugerida." />
      {message && <div className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-4 text-cyan-100">{message}</div>}
      <div className="neon-card overflow-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              {["Número", "Cliente", "Status", "Tecnologia", "Formato", "Processadora", "Valor", "Data", "Ações"].map((heading) => <th className="px-4 py-3" key={heading}>{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => {
              const area = calculateArea(quote.width, quote.height);
              const pixels = calculatePixelLoad(quote.width, quote.height, quote.product.pixelPitchMm);
              const processor = suggestProcessor(pixels.requiredPorts);
              const total = calculateQuoteTotal({
                area,
                pricePerSqm: quote.product.pricePerSqm,
                category: quote.product.category,
                includeStructure: quote.includeStructure,
                includeInstallation: quote.includeInstallation,
                includeProcessor: quote.includeProcessor,
                includeFreight: quote.includeFreight,
                includeTechnicalVisit: quote.includeTechnicalVisit,
                includeExtendedWarranty: quote.includeExtendedWarranty,
                processorCost: quote.processorCost,
                freightCost: quote.freightCost,
                technicalVisitCost: quote.technicalVisitCost,
                extendedWarrantyCost: quote.extendedWarrantyCost,
                marginPercent: quote.marginPercent,
                discountPercent: quote.discountPercent,
              }).total;
              return (
                <tr className="border-t border-white/5 text-slate-200" key={quote.id}>
                  <td className="px-4 py-3 font-semibold text-white">{quote.quoteNumber}</td>
                  <td className="px-4 py-3">{quote.client.name}</td>
                  <td className="px-4 py-3"><StatusBadge status={quote.status} /></td>
                  <td className="px-4 py-3">{quote.product.technology} {quote.product.pixelPitch}</td>
                  <td className="px-4 py-3">{detectFormat(quote.width, quote.height)}</td>
                  <td className="px-4 py-3">{processor.name}</td>
                  <td className="px-4 py-3">{formatBRL(total)}</td>
                  <td className="px-4 py-3">{new Date(quote.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="btn-secondary h-9" onClick={() => onEdit(quote)}>Editar</button>
                      {quote.createdBy === profile?.id && (
                        <button className="btn-secondary h-9" onClick={() => void deleteQuote(quote.id).then((result) => setMessage(result.message))}>Excluir</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClientsPage() {
  const clients = useBorealStore((state) => state.clients);
  const saveClient = useBorealStore((state) => state.saveClient);
  const profile = useBorealStore((state) => state.profile);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Client>({
    id: crypto.randomUUID(),
    name: "",
    document: "",
    phone: "",
    email: "",
    city: "Cuiabá",
    state: "MT",
    projectName: "",
    installationSite: "",
    notes: "",
    partnerId: profile?.partner_id ?? "",
    createdBy: profile?.id ?? "",
  });

  async function handleSaveClient() {
    if (!draft.name.trim()) {
      setMessage("Informe o nome do cliente.");
      return;
    }
    const result = await saveClient({ ...draft, id: draft.id || crypto.randomUUID() });
    setMessage(result.message);
    if (result.ok) {
      setDraft({
        id: crypto.randomUUID(),
        name: "",
        document: "",
        phone: "",
        email: "",
        city: "Cuiabá",
        state: "MT",
        projectName: "",
        installationSite: "",
        notes: "",
        partnerId: profile?.partner_id ?? "",
        createdBy: profile?.id ?? "",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" subtitle="Clientes cadastrados pelo parceiro, com status comercial protegido." />
      <div className="neon-card grid gap-4 p-5">
        <h2 className="text-xl font-bold text-white">Cadastrar cliente</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Nome" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
          <Input label="CPF/CNPJ" value={draft.document} onChange={(value) => setDraft((current) => ({ ...current, document: value }))} />
          <Input label="Telefone" value={draft.phone} onChange={(value) => setDraft((current) => ({ ...current, phone: value }))} />
          <Input label="E-mail" value={draft.email} onChange={(value) => setDraft((current) => ({ ...current, email: value }))} />
          <Input label="Cidade" value={draft.city} onChange={(value) => setDraft((current) => ({ ...current, city: value }))} />
          <Input label="Estado" value={draft.state} onChange={(value) => setDraft((current) => ({ ...current, state: value }))} />
          <Input label="Projeto" value={draft.projectName} onChange={(value) => setDraft((current) => ({ ...current, projectName: value }))} />
          <Input label="Local de instalação" value={draft.installationSite} onChange={(value) => setDraft((current) => ({ ...current, installationSite: value }))} />
        </div>
        <TextArea label="Observações" value={draft.notes} onChange={(value) => setDraft((current) => ({ ...current, notes: value }))} />
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={() => void handleSaveClient()}>Salvar cliente</button>
          {message && <span className="text-sm text-cyan-100">{message}</span>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {clients.map((client) => (
          <div className="neon-card p-5" key={client.id}>
            <h3 className="text-xl font-bold text-white">{client.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{client.document}</p>
            <dl className="mt-4 grid gap-2 text-sm">
              <Info label="Cidade" value={`${client.city}/${client.state}`} />
              <Info label="Telefone" value={client.phone || "Não informado"} />
              <Info label="Projeto" value={client.projectName || "Não informado"} />
              <Info label="Status" value="Registro ativo" />
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function PartnersPage() {
  const partners = useBorealStore((state) => state.partners);
  const createPartner = useBorealStore((state) => state.createPartner);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Partner>({
    id: crypto.randomUUID(),
    companyName: "",
    tradeName: "",
    cnpj: "",
    email: "",
    phone: "",
    city: "",
    state: "MT",
    status: "active",
  });
  const [adminUserId, setAdminUserId] = useState("");
  const [adminName, setAdminName] = useState("");

  async function handleCreatePartner() {
    if (!draft.companyName.trim()) {
      setMessage("Informe a razão social do parceiro.");
      return;
    }
    const result = await createPartner(draft, adminUserId || undefined, adminName || undefined);
    setMessage(result.message);
    if (result.ok) {
      setDraft({ id: crypto.randomUUID(), companyName: "", tradeName: "", cnpj: "", email: "", phone: "", city: "", state: "MT", status: "active" });
      setAdminUserId("");
      setAdminName("");
    }
  }

  return (
    <AdminShell title="Parceiros" subtitle="Área exclusiva Admin Master Boreal para parceiros, usuários, volume comercial e conflitos.">
      <div className="neon-card grid gap-4 p-5">
        <h2 className="text-xl font-bold text-white">Cadastrar parceiro</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Razão social" value={draft.companyName} onChange={(value) => setDraft((current) => ({ ...current, companyName: value }))} />
          <Input label="Nome fantasia" value={draft.tradeName} onChange={(value) => setDraft((current) => ({ ...current, tradeName: value }))} />
          <Input label="CNPJ" value={draft.cnpj} onChange={(value) => setDraft((current) => ({ ...current, cnpj: value }))} />
          <Input label="E-mail do parceiro" value={draft.email} onChange={(value) => setDraft((current) => ({ ...current, email: value }))} />
          <Input label="Telefone" value={draft.phone} onChange={(value) => setDraft((current) => ({ ...current, phone: value }))} />
          <Input label="Cidade" value={draft.city} onChange={(value) => setDraft((current) => ({ ...current, city: value }))} />
          <Input label="Estado" value={draft.state} onChange={(value) => setDraft((current) => ({ ...current, state: value }))} />
          <Input label="User ID do Auth para acesso" value={adminUserId} onChange={setAdminUserId} />
          <Input label="Nome do administrador" value={adminName} onChange={setAdminName} />
        </div>
        <p className="text-sm text-slate-400">Para liberar acesso, crie o usuário em Supabase Auth e cole o User ID aqui. O app vincula esse usuário ao parceiro como partner_admin.</p>
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={() => void handleCreatePartner()}>Salvar parceiro</button>
          {message && <span className="text-sm text-cyan-100">{message}</span>}
        </div>
      </div>
      {partners.map((partner) => (
        <div className="neon-card p-5" key={partner.id}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">{partner.tradeName || partner.companyName}</h3>
              <p className="text-sm text-slate-400">{partner.companyName} · {partner.city}/{partner.state} · {partner.email}</p>
            </div>
            <span className="badge">{partner.status === "active" ? "Ativo" : "Inativo"}</span>
          </div>
        </div>
      ))}
    </AdminShell>
  );
}

function SettingsPage() {
  const products = useBorealStore((state) => state.products);
  const upsertProduct = useBorealStore((state) => state.upsertProduct);
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? "");
  const selected = products.find((product) => product.id === selectedId) ?? products[0];
  const [message, setMessage] = useState("");

  function updateSelected<K extends keyof Product>(key: K, value: Product[K]) {
    if (!selected) return;
    void upsertProduct({ ...selected, [key]: value }).then((result) => setMessage(result.message));
  }

  return (
    <AdminShell title="Configurações" subtitle="Base editável de produtos, valores por m², processadoras, serviços e textos comerciais.">
      <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <div className="neon-card p-5">
          <h2 className="text-xl font-bold text-white">Catálogo</h2>
          <div className="mt-4 grid gap-2">
            {products.map((product) => (
              <button
                className={cx("rounded-md border px-3 py-2 text-left text-sm", selectedId === product.id ? "border-cyan-300/70 bg-cyan-300/10 text-white" : "border-white/10 bg-white/5 text-slate-300")}
                key={product.id}
                onClick={() => setSelectedId(product.id)}
              >
                {product.technology} {product.pixelPitch} · {formatBRL(product.pricePerSqm)}/m²
              </button>
            ))}
          </div>
        </div>
        {selected && (
          <div className="neon-card grid gap-4 p-5">
            <h2 className="text-xl font-bold text-white">Editar item</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Tecnologia" value={selected.technology} onChange={(value) => updateSelected("technology", value)} />
              <Input label="Pixel pitch" value={selected.pixelPitch} onChange={(value) => updateSelected("pixelPitch", value)} />
              <Input label="Pixel pitch mm" type="number" value={selected.pixelPitchMm} onChange={(value) => updateSelected("pixelPitchMm", Number(value))} />
              <Input label="Gabinete" value={selected.cabinetSize ?? ""} onChange={(value) => updateSelected("cabinetSize", value || null)} />
              <Input label="Preço por m²" type="number" value={selected.pricePerSqm} onChange={(value) => updateSelected("pricePerSqm", Number(value))} />
              <Input label="Aplicação" value={selected.application} onChange={(value) => updateSelected("application", value)} />
              <Input label="Vida útil" type="number" value={selected.lifespanHours} onChange={(value) => updateSelected("lifespanHours", Number(value))} />
            </div>
            <TextArea label="Uso recomendado" value={selected.recommendedUse} onChange={(value) => updateSelected("recommendedUse", value)} />
            <label className="space-y-2">
              <span className="label">Imagem do gabinete / especificação</span>
              <input
                className="block w-full text-sm text-slate-300 file:mr-4 file:h-10 file:rounded-md file:border-0 file:bg-cyan-300 file:px-4 file:text-sm file:font-semibold file:text-slate-950"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void readImageFile(file).then((imageDataUrl) => updateSelected("imageDataUrl", imageDataUrl));
                }}
              />
            </label>
            {selected.imageDataUrl && (
              <div className="space-y-3">
                <img className="max-h-72 w-full rounded-md object-contain" src={selected.imageDataUrl} alt="Imagem do produto" />
                <button className="btn-secondary" onClick={() => updateSelected("imageDataUrl", undefined)}>
                  Remover imagem
                </button>
              </div>
            )}
            {message && <p className="text-sm text-cyan-100">{message}</p>}
          </div>
        )}
        <ConfigBlock title="Serviços padrão" text="Estrutura Indoor R$ 1.000/m², Outdoor R$ 2.000/m² e instalação R$ 600/m². A edição granular desses serviços fica no próximo bloco da plataforma." />
        <ConfigBlock title="PDF comercial" text="A proposta agora recebe imagem por upload no orçamento e usa capa, resumo executivo e tabela comercial." />
      </div>
    </AdminShell>
  );
}

function AdminShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const profile = useBorealStore((state) => state.profile);

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      <div className="rounded-lg border border-cyan-300/25 bg-cyan-300/10 p-4 text-cyan-100">
        <div className="flex gap-3">
          <ShieldCheck className="h-5 w-5" />
          <p>{profile?.role === "master_admin" ? "Área Admin Master ativa via Supabase RLS." : "Esta seção é exclusiva para o perfil Admin Master Boreal."}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function RestrictedPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Acesso restrito" subtitle="Esta área é exclusiva para o perfil Admin Master Boreal." />
      <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-amber-100">
        <div className="flex gap-3">
          <ShieldCheck className="h-5 w-5" />
          <p>Seu perfil atual não possui permissão para administrar parceiros, catálogo e regras globais.</p>
        </div>
      </div>
    </div>
  );
}

function ConfigBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="neon-card p-5">
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 text-slate-300">{text}</p>
      <button className="btn-secondary mt-4">Editar</button>
    </div>
  );
}

async function exportQuotePdf(quote: Quote) {
  const { jsPDF } = await import("jspdf");
  const logoDataUrl = await loadImageDataUrl(borealLogoPath);
  const coverDataUrl = await loadImageDataUrl(borealPdfCoverPath);
  const aboutDataUrl = await loadImageDataUrl(borealAboutSlidePath);
  const expertiseDataUrl = await loadImageDataUrl(borealExpertiseSlidePath);
  const coverSize = await getImageSize(borealPdfCoverPath);
  const aboutSize = await getImageSize(borealAboutSlidePath);
  const expertiseSize = await getImageSize(borealExpertiseSlidePath);
  const area = calculateArea(quote.width, quote.height);
  const pixelLoad = calculatePixelLoad(quote.width, quote.height, quote.product.pixelPitchMm);
  const processor = suggestProcessor(pixelLoad.requiredPorts);
  const totals = calculateQuoteTotal({
    area,
    pricePerSqm: quote.product.pricePerSqm,
    category: quote.product.category,
    includeStructure: quote.includeStructure,
    includeInstallation: quote.includeInstallation,
    includeProcessor: quote.includeProcessor,
    includeFreight: quote.includeFreight,
    includeTechnicalVisit: quote.includeTechnicalVisit,
    includeExtendedWarranty: quote.includeExtendedWarranty,
    processorCost: quote.processorCost,
    freightCost: quote.freightCost,
    technicalVisitCost: quote.technicalVisitCost,
    extendedWarrantyCost: quote.extendedWarrantyCost,
    marginPercent: quote.marginPercent,
    discountPercent: quote.discountPercent,
  });
  const doc = new jsPDF({ compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const screenEntries = [
    { product: quote.product, width: quote.width, height: quote.height, label: "Tela principal" },
    ...(quote.screens ?? []),
  ];
  const screenPanelTotal = screenEntries.reduce((sum, screen) => sum + calculateArea(screen.width, screen.height) * screen.product.pricePerSqm, 0);
  const grandTotal = totals.total - totals.withMargin.panel + screenPanelTotal * (1 + quote.marginPercent / 100);

  function addImageCover(dataUrl: string, size: { width: number; height: number }) {
    const imageRatio = size.width / size.height;
    const pageRatio = pageWidth / pageHeight;
    let width = pageWidth;
    let height = pageHeight;
    let x = 0;
    let y = 0;

    if (imageRatio > pageRatio) {
      height = pageHeight;
      width = height * imageRatio;
      x = (pageWidth - width) / 2;
    } else {
      width = pageWidth;
      height = width / imageRatio;
      y = (pageHeight - height) / 2;
    }

    doc.addImage(dataUrl, "PNG", x, y, width, height, undefined, "FAST");
  }

  async function addDataUrlCover(dataUrl: string, x: number, y: number, boxWidth: number, boxHeight: number) {
    const size = await getImageSize(dataUrl);
    const imageRatio = size.width / size.height;
    const boxRatio = boxWidth / boxHeight;
    let width = boxWidth;
    let height = boxHeight;
    let drawX = x;
    let drawY = y;

    if (imageRatio > boxRatio) {
      height = boxHeight;
      width = height * imageRatio;
      drawX = x + (boxWidth - width) / 2;
    } else {
      width = boxWidth;
      height = width / imageRatio;
      drawY = y + (boxHeight - height) / 2;
    }

    const format = dataUrl.includes("image/png") ? "PNG" : "JPEG";
    doc.addImage(dataUrl, format, drawX, drawY, width, height, undefined, "FAST");
  }

  function header(title: string, subtitle?: string) {
    doc.setFillColor(2, 6, 23);
    doc.rect(0, 0, 210, 297, "F");
    doc.setFillColor(24, 228, 255);
    doc.rect(0, 0, 6, 297, "F");
    doc.addImage(logoDataUrl, "PNG", 16, 10, 58, 20, undefined, "FAST");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text(title, 16, 42);
    if (subtitle) {
      doc.setTextColor(190, 205, 220);
      doc.setFontSize(10);
      doc.text(subtitle, 16, 50);
    }
  }

  function infoRow(label: string, value: string, x: number, y: number, width = 82) {
    doc.setFillColor(8, 18, 36);
    doc.roundedRect(x, y, width, 15, 2, 2, "F");
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x + 3, y + 5);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(value, width - 6), x + 3, y + 11);
  }

  function neonPanel(x: number, y: number, width: number, height: number, title: string) {
    doc.setFillColor(5, 13, 28);
    doc.setDrawColor(24, 228, 255);
    doc.roundedRect(x, y, width, height, 3, 3, "FD");
    doc.setDrawColor(139, 92, 246);
    doc.line(x + 3, y + height - 2, x + width - 3, y + height - 2);
    doc.setTextColor(24, 228, 255);
    doc.setFontSize(8);
    doc.text(title.toUpperCase(), x + 5, y + 9);
  }

  addImageCover(coverDataUrl, coverSize);
  doc.setFillColor(2, 6, 23);
  doc.rect(0, 246, 210, 51, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text(doc.splitTextToSize(quote.client.name || "Cliente", 112), 188, 276, { align: "right" });

  doc.addPage();
  addImageCover(aboutDataUrl, aboutSize);

  doc.addPage();
  addImageCover(expertiseDataUrl, expertiseSize);

  doc.addPage();
  header("Proposta comercial", `${quote.quoteNumber} · ${new Date().toLocaleDateString("pt-BR")}`);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(34);
  doc.text(quote.client.name || "Cliente", 16, 72);
  doc.setTextColor(190, 205, 220);
  doc.setFontSize(12);
  doc.text(doc.splitTextToSize(`${screenEntries.length} tela(s) · ${quote.width.toFixed(2)} x ${quote.height.toFixed(2)} m · ${area.toFixed(2)} m2`, 160), 16, 84);

  if (quote.productImageDataUrl) {
    await addDataUrlCover(quote.productImageDataUrl, 16, 94, 178, 82);
  } else {
    doc.setFillColor(8, 18, 36);
    doc.roundedRect(16, 94, 178, 82, 3, 3, "F");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(12);
    doc.text("Imagem do produto nao enviada", pageWidth / 2, 138, { align: "center" });
  }

  neonPanel(16, 186, 83, 28, "Cliente");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(doc.splitTextToSize(quote.client.projectName || quote.client.name || "Projeto Boreal", 72), 21, 204);

  neonPanel(106, 186, 88, 28, "Resumo do escopo");
  doc.setTextColor(0, 145, 170);
  doc.setFontSize(20);
  doc.text(String(screenEntries.length), 112, 205);
  doc.text(screenEntries.reduce((sum, screen) => sum + calculateArea(screen.width, screen.height), 0).toFixed(2), 142, 205);
  doc.text(String(pixelLoad.requiredPorts), 181, 205);
  doc.setTextColor(190, 205, 220);
  doc.setFontSize(7);
  doc.text("PAINEIS", 112, 211);
  doc.text("M2 TOTAL", 142, 211);
  doc.text("PROC.", 181, 211);

  neonPanel(16, 222, 178, 38, "Paineis LED");
  doc.setFillColor(8, 18, 36);
  doc.rect(21, 236, 168, 9, "F");
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.text("MODELO", 25, 242);
  doc.text("L (M)", 104, 242);
  doc.text("A (M)", 126, 242);
  doc.text("M2", 151, 242);
  doc.text("MOD.", 174, 242);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  screenEntries.slice(0, 3).forEach((screen, index) => {
    const rowY = 252 + index * 7;
    doc.text(`${screen.product.technology} ${screen.product.pixelPitch}`, 25, rowY);
    doc.text(screen.width.toFixed(2), 104, rowY);
    doc.text(screen.height.toFixed(2), 126, rowY);
    doc.text(calculateArea(screen.width, screen.height).toFixed(2), 151, rowY);
    doc.text(String(Math.max(1, Math.ceil(calculateArea(screen.width, screen.height) * 2))), 176, rowY);
  });

  const rows = [
    ["Painel de LED", screenPanelTotal * (1 + quote.marginPercent / 100)],
    ["Estrutura", totals.withMargin.structure],
    ["Instalação", totals.withMargin.installation],
    ["Processadora", totals.withMargin.processor],
    ["Frete", totals.withMargin.freight],
    ["Serviços técnicos", totals.withMargin.technicalVisit + totals.withMargin.extendedWarranty],
    ["Desconto", totals.discountValue],
  ].filter(([, value]) => Number(value) > 0);

  doc.addPage();
  header("Resumo técnico", "Dimensionamento do painel, pixels e processamento");
  infoRow("Produto", `${quote.product.technology} ${quote.product.pixelPitch}`, 16, 54, 82);
  infoRow("Medida", `${quote.width.toFixed(2)} x ${quote.height.toFixed(2)} m`, 106, 54, 88);
  infoRow("Área", `${area.toFixed(2)} m2`, 16, 76, 52);
  infoRow("Resolução", `${pixelLoad.pixelsWidth} x ${pixelLoad.pixelsHeight} px`, 74, 76, 62);
  infoRow("Portas", String(pixelLoad.requiredPorts), 142, 76, 52);
  infoRow("Processadora", processor.name, 16, 98, 82);
  infoRow("Formato", detectFormat(quote.width, quote.height), 106, 98, 88);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text("Imagem e especificação do produto", 16, 128);
  doc.setFillColor(5, 13, 28);
  doc.setDrawColor(24, 228, 255);
  doc.roundedRect(16, 136, 82, 72, 3, 3, "FD");
  if (quote.product.imageDataUrl) {
    await addDataUrlCover(quote.product.imageDataUrl, 20, 140, 74, 64);
  } else {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(10);
    doc.text("Imagem do produto nao cadastrada", 57, 172, { align: "center" });
  }

  neonPanel(106, 136, 88, 72, "Aplicação recomendada");
  doc.setTextColor(190, 205, 220);
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(quote.product.recommendedUse || "Aplicação sob validação técnica Boreal.", 78), 111, 154);

  if (screenEntries.length > 1) {
    neonPanel(16, 220, 178, 42, "Telas do projeto");
    doc.setTextColor(226, 232, 240);
    doc.setFontSize(8);
    screenEntries.slice(0, 4).forEach((screen, index) => {
      doc.text(`${index + 1}. ${screen.label} · ${screen.product.technology} ${screen.product.pixelPitch} · ${screen.width.toFixed(2)} x ${screen.height.toFixed(2)} m`, 22, 238 + index * 7);
    });
  }

  doc.addPage();
  header("Composição comercial", "Garantia, resistências e valores finais");
  neonPanel(16, 56, 178, 42, "Garantia · Vida útil · Resistências");
  doc.setTextColor(0, 145, 170);
  doc.setFontSize(18);
  doc.text("100.000h", 26, 79);
  doc.text(quote.product.category === "outdoor" ? "IP65" : "IP54", 88, 79);
  doc.text("ALTA", 150, 79);
  doc.setTextColor(190, 205, 220);
  doc.setFontSize(7);
  doc.text("VIDA UTIL DOS LEDS", 26, 87);
  doc.text("RESISTENCIA", 88, 87);
  doc.text("IMPACTO, UV E UMIDADE", 138, 87);

  let y = 124;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text("Composição comercial", 16, y - 8);
  rows.forEach(([label, value]) => {
    doc.setFillColor(8, 18, 36);
    doc.roundedRect(16, y, 178, 13, 2, 2, "F");
    doc.setTextColor(226, 232, 240);
    doc.setFontSize(10);
    doc.text(String(label), 22, y + 8);
    doc.text(formatBRL(Number(value)), 188, y + 8, { align: "right" });
    y += 16;
  });
  doc.setFillColor(24, 228, 255);
  doc.roundedRect(16, y + 6, 178, 24, 3, 3, "F");
  doc.setTextColor(2, 6, 23);
  doc.setFontSize(11);
  doc.text("Total final", 22, y + 17);
  doc.setFontSize(20);
  doc.text(formatBRL(grandTotal), 188, y + 19, { align: "right" });
  doc.setTextColor(190, 205, 220);
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize("Garantia, vida util e condicoes comerciais seguem a validacao tecnica e o aceite formal da proposta. Esta apresentacao nao exibe custos internos da Boreal ou do parceiro.", 178), 16, y + 48);
  doc.save(`${quote.quoteNumber}.pdf`);
}

function App() {
  const [logged, setLogged] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const setProfile = useBorealStore((state) => state.setProfile);
  const loadWorkspace = useBorealStore((state) => state.loadWorkspace);
  const resetData = useBorealStore((state) => state.resetData);
  const profile = useBorealStore((state) => state.profile);

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      await loadProfile(data.session.user);
      setLogged(true);
      await loadWorkspace();
    });
  }, [loadWorkspace]);

  async function loadProfile(user: User) {
    if (!supabase) return;

    const email = user.email ?? "";
    const metadataRole = user.user_metadata?.role === "master_admin" ? "master_admin" : "partner_admin";
    const metadataName = typeof user.user_metadata?.name === "string" ? user.user_metadata.name : email || "Usuário sem perfil";

    const { data, error } = await supabase
      .from("profiles")
      .select("id, partner_id, name, email, role")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data) {
      setProfile({
        id: user.id,
        partner_id: null,
        name: metadataName,
        email,
        role: metadataRole,
      });
      return;
    }

    setProfile(data as { id: string; partner_id: string | null; name: string; email: string; role: Role });
  }

  async function handleLogin(email: string, password: string) {
    if (!supabase) {
      setProfile({
        id: "user-demo",
        partner_id: "partner-demo",
        name: "Admin Parceiro Demo",
        email,
        role: "partner_admin",
      });
      setLogged(true);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw new Error(error.message);
    }

    await loadProfile(data.user);
    await loadWorkspace();
    setLogged(true);
  }

  async function handleLogout() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setProfile(null);
    resetData();
    setLogged(false);
    setPage("dashboard");
  }

  if (!logged) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <BorealLayout page={page} setPage={setPage} onLogout={() => void handleLogout()}>
      {page === "dashboard" && <DashboardPage />}
      {page === "new" && <QuoteWizard editingQuote={editingQuote} onDone={() => setEditingQuote(null)} />}
      {page === "catalog" && <CatalogPage onQuote={() => setPage("new")} />}
      {page === "quotes" && <QuotesPage onEdit={(quote) => { setEditingQuote(quote); setPage("new"); }} />}
      {page === "clients" && <ClientsPage />}
      {page === "partners" && (profile?.role === "master_admin" ? <PartnersPage /> : <RestrictedPage />)}
      {page === "settings" && (profile?.role === "master_admin" ? <SettingsPage /> : <RestrictedPage />)}
      <div className="mt-8 text-xs text-slate-500">Sessão: {profile?.role ?? "partner_admin"}. Margem interna e conflitos comerciais nunca aparecem no PDF do cliente.</div>
    </BorealLayout>
  );
}

export default App;
