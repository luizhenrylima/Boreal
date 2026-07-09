import { create } from "zustand";
import { products as defaultProducts } from "./data";
import { calculateArea, calculatePixelLoad, calculateQuoteTotal, detectFormat, suggestProcessor } from "./calculations";
import { supabase } from "./supabaseClient";
import type { Client, Partner, Product, Quote, Role } from "./types";

export type Profile = {
  id: string;
  partner_id: string | null;
  name: string;
  email: string;
  role: Role;
};

type PartnerRow = {
  id: string;
  company_name: string;
  trade_name: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
};

type ClientRow = {
  id: string;
  partner_id: string | null;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  project_name: string | null;
  installation_site: string | null;
  notes: string | null;
  created_by: string | null;
};

type ProductRow = {
  id: string;
  technology: string;
  pixel_pitch: string;
  pixel_pitch_mm: number;
  category: Product["category"];
  cabinet_size: string | null;
  price_per_sqm: number;
  supplier: "LED Wave";
  processor_system: "NovaStar";
  lifespan_hours: number;
  application: string | null;
  recommended_use: string | null;
  technical_specs: { imageDataUrl?: string } | null;
  active: boolean | null;
};

type QuoteRow = {
  id: string;
  created_by: string | null;
  quote_number: string | null;
  status: Quote["status"] | null;
  width: number;
  height: number;
  include_structure: boolean | null;
  include_installation: boolean | null;
  include_processor: boolean | null;
  include_freight: boolean | null;
  include_technical_visit: boolean | null;
  include_extended_warranty: boolean | null;
  processor_cost: number | null;
  freight_cost: number | null;
  technical_visit_cost: number | null;
  extended_warranty_cost: number | null;
  margin_percent: number | null;
  discount_percent: number | null;
  price_per_sqm: number | null;
  pixel_pitch_mm: number | null;
  notes: string | null;
  created_at: string | null;
  clients: ClientRow | null;
  products: ProductRow | null;
};

type SaveResult = Promise<{ ok: boolean; message: string }>;

type AppState = {
  clients: Client[];
  quotes: Quote[];
  products: Product[];
  partners: Partner[];
  profile: Profile | null;
  isRemoteReady: boolean;
  isSyncing: boolean;
  syncError: string;
  setProfile: (profile: Profile | null) => void;
  loadWorkspace: () => Promise<void>;
  addClient: (client: Client) => void;
  saveClient: (client: Client) => SaveResult;
  addQuote: (quote: Quote) => void;
  updateQuote: (quote: Quote) => void;
  deleteQuote: (quoteId: string) => SaveResult;
  saveQuote: (client: Client, quote: Quote) => SaveResult;
  upsertProduct: (product: Product) => SaveResult;
  createPartner: (partner: Partner, adminUserId?: string, adminName?: string) => SaveResult;
  resetData: () => void;
};

const ADMIN_PARTNER_ID = "00000000-0000-0000-0000-000000000001";

function profilePartnerId(profile: Profile | null) {
  return profile?.partner_id ?? (profile?.role === "master_admin" ? ADMIN_PARTNER_ID : null);
}

function mapPartner(row: PartnerRow): Partner {
  return {
    id: row.id,
    companyName: row.company_name,
    tradeName: row.trade_name ?? "",
    cnpj: row.cnpj ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    status: row.status === "inactive" ? "inactive" : "active",
  };
}

function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    document: row.document ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    projectName: row.project_name ?? "",
    installationSite: row.installation_site ?? "",
    notes: row.notes ?? "",
    partnerId: row.partner_id ?? "",
    createdBy: row.created_by ?? "",
  };
}

function mapProduct(row: ProductRow | null, quoteRow?: Pick<QuoteRow, "price_per_sqm" | "pixel_pitch_mm">): Product {
  if (!row) {
    return (
      defaultProducts.find(
        (product) =>
          product.pixelPitchMm === Number(quoteRow?.pixel_pitch_mm) &&
          product.pricePerSqm === Number(quoteRow?.price_per_sqm),
      ) ?? defaultProducts[0]
    );
  }

  const localProduct = defaultProducts.find(
    (product) => product.technology === row.technology && product.pixelPitch === row.pixel_pitch,
  );

  return {
    id: row.id,
    category: row.category,
    technology: row.technology,
    pixelPitch: row.pixel_pitch,
    pixelPitchMm: Number(row.pixel_pitch_mm),
    cabinetSize: row.cabinet_size,
    pricePerSqm: Number(row.price_per_sqm),
    supplier: row.supplier,
    processorSystem: row.processor_system,
    lifespanHours: Number(row.lifespan_hours),
    application: row.application ?? localProduct?.application ?? row.category,
    recommendedUse: row.recommended_use ?? localProduct?.recommendedUse ?? "",
    imageDataUrl: row.technical_specs?.imageDataUrl ?? localProduct?.imageDataUrl,
    formats: localProduct?.formats ?? [],
    technicalHighlights: localProduct?.technicalHighlights ?? [],
    commercialDifferentials: localProduct?.commercialDifferentials ?? [],
  };
}

function mapQuote(row: QuoteRow): Quote {
  let quoteMeta: { productImageDataUrl?: string; screens?: Quote["screens"] } = {};
  if (row.notes) {
    try {
      quoteMeta = JSON.parse(row.notes) as typeof quoteMeta;
    } catch {
      quoteMeta = row.notes.startsWith("product_image_data_url:")
        ? { productImageDataUrl: row.notes.replace("product_image_data_url:", "") }
        : {};
    }
  }

  const client = row.clients ? mapClient(row.clients) : {
    id: "",
    name: "Cliente removido",
    document: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    projectName: "",
    installationSite: "",
    notes: "",
    partnerId: "",
    createdBy: "",
  };

  return {
    id: row.id,
    quoteNumber: row.quote_number ?? "Sem numero",
    client,
    createdBy: row.created_by ?? "",
    product: mapProduct(row.products, row),
    width: Number(row.width),
    height: Number(row.height),
    includeStructure: Boolean(row.include_structure),
    includeInstallation: Boolean(row.include_installation),
    includeProcessor: Boolean(row.include_processor),
    includeFreight: Boolean(row.include_freight),
    includeTechnicalVisit: Boolean(row.include_technical_visit),
    includeExtendedWarranty: Boolean(row.include_extended_warranty),
    processorCost: Number(row.processor_cost ?? 0),
    freightCost: Number(row.freight_cost ?? 0),
    technicalVisitCost: Number(row.technical_visit_cost ?? 0),
    extendedWarrantyCost: Number(row.extended_warranty_cost ?? 0),
    marginPercent: Number(row.margin_percent ?? 0),
    discountPercent: Number(row.discount_percent ?? 0),
    status: row.status ?? "draft",
    createdAt: row.created_at ?? new Date().toISOString(),
    productImageDataUrl: quoteMeta.productImageDataUrl,
    screens: quoteMeta.screens,
  };
}

function productPayload(product: Product) {
  const payload = {
    category: product.category,
    technology: product.technology,
    pixel_pitch: product.pixelPitch,
    pixel_pitch_mm: product.pixelPitchMm,
    cabinet_size: product.cabinetSize,
    price_per_sqm: product.pricePerSqm,
    supplier: product.supplier,
    processor_system: product.processorSystem,
    lifespan_hours: product.lifespanHours,
    application: product.application,
    recommended_use: product.recommendedUse,
    technical_specs: {
      imageDataUrl: product.imageDataUrl,
    },
    active: true,
  };
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product.id)
    ? { id: product.id, ...payload }
    : payload;
}

function clientPayload(client: Client, profile: Profile, partnerId: string) {
  return {
    id: client.id,
    partner_id: partnerId,
    name: client.name,
    document: client.document,
    phone: client.phone,
    email: client.email,
    city: client.city,
    state: client.state,
    project_name: client.projectName,
    installation_site: client.installationSite,
    notes: client.notes,
    created_by: profile.id,
  };
}

export const useBorealStore = create<AppState>((set, get) => ({
  clients: [],
  quotes: [],
  products: defaultProducts,
  partners: [],
  profile: null,
  isRemoteReady: false,
  isSyncing: false,
  syncError: "",
  setProfile: (profile) => set({ profile, isRemoteReady: Boolean(profilePartnerId(profile)) }),
  loadWorkspace: async () => {
    if (!supabase) return;

    set({ isSyncing: true, syncError: "" });

    const [clientsResult, quotesResult, productsResult, partnersResult] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("quotes").select("*, clients(*), products(*)").order("created_at", { ascending: false }),
      supabase.from("products").select("*").order("technology"),
      supabase.from("partners").select("*").order("company_name"),
    ]);

    if (clientsResult.error || quotesResult.error || productsResult.error || partnersResult.error) {
      set({
        isSyncing: false,
        syncError:
          clientsResult.error?.message ??
          quotesResult.error?.message ??
          productsResult.error?.message ??
          partnersResult.error?.message ??
          "Nao foi possivel carregar os dados do Supabase.",
      });
      return;
    }

    set({
      clients: (clientsResult.data as ClientRow[]).map(mapClient),
      quotes: (quotesResult.data as unknown as QuoteRow[]).map(mapQuote),
      products: (productsResult.data as ProductRow[]).map((row) => mapProduct(row)),
      partners: (partnersResult.data as PartnerRow[]).map(mapPartner),
      isSyncing: false,
      syncError: "",
    });
  },
  addClient: (client) => set((state) => ({ clients: [client, ...state.clients] })),
  saveClient: async (client) => {
    const profile = get().profile;
    const partnerId = profilePartnerId(profile);

    if (!supabase) {
      return { ok: false, message: "Cliente nao foi salvo: Supabase nao esta configurado neste ambiente." };
    }

    if (!profile || !partnerId) {
      return { ok: false, message: "Cliente nao foi salvo: usuario sem perfil ou parceiro vinculado no Supabase." };
    }

    const { error } = await supabase.from("clients").upsert(clientPayload(client, profile, partnerId));
    if (error) {
      return { ok: false, message: `Cliente nao foi salvo: Supabase recusou: ${error.message}` };
    }

    set((state) => ({
      clients: state.clients.some((item) => item.id === client.id)
        ? state.clients.map((item) => (item.id === client.id ? client : item))
        : [client, ...state.clients],
    }));

    return { ok: true, message: "Cliente salvo no Supabase." };
  },
  addQuote: (quote) => set((state) => ({ quotes: [quote, ...state.quotes] })),
  updateQuote: (quote) => set((state) => ({ quotes: state.quotes.map((item) => (item.id === quote.id ? quote : item)) })),
  deleteQuote: async (quoteId) => {
    if (!supabase) return { ok: false, message: "Cotacao nao foi excluida: Supabase nao esta configurado neste ambiente." };
    const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
    if (error) {
      return { ok: false, message: `Cotacao nao foi excluida: Supabase recusou: ${error.message}` };
    }
    set((state) => ({ quotes: state.quotes.filter((quote) => quote.id !== quoteId) }));
    return { ok: true, message: "Cotacao excluida." };
  },
  saveQuote: async (client, quote) => {
    const profile = get().profile;
    const partnerId = profilePartnerId(profile);

    if (!supabase) {
      return {
        ok: false,
        message: "Cotacao nao foi salva: Supabase nao esta configurado neste ambiente.",
      };
    }

    if (!profile || !partnerId) {
      return {
        ok: false,
        message: "Cotacao nao foi salva: usuario sem perfil ou parceiro vinculado no Supabase.",
      };
    }

    const { data: productRow } = await supabase
      .from("products")
      .select("id")
      .eq("technology", quote.product.technology)
      .eq("pixel_pitch", quote.product.pixelPitch)
      .maybeSingle();

    const { error: clientError } = await supabase.from("clients").upsert(clientPayload(client, profile, partnerId));

    if (clientError) {
      return { ok: false, message: `Cotacao salva localmente. Supabase recusou o cliente: ${clientError.message}` };
    }

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

    const { data: savedQuote, error: quoteError } = await supabase.from("quotes").upsert({
      id: quote.id,
      partner_id: partnerId,
      client_id: client.id,
      created_by: profile.id,
      product_id: productRow?.id ?? null,
      quote_number: quote.quoteNumber,
      status: quote.status,
      width: quote.width,
      height: quote.height,
      area,
      aspect_ratio: quote.width / quote.height,
      format_type: detectFormat(quote.width, quote.height),
      pixel_pitch_mm: quote.product.pixelPitchMm,
      pixels_width: pixelLoad.pixelsWidth,
      pixels_height: pixelLoad.pixelsHeight,
      total_pixels: pixelLoad.totalPixels,
      required_processor_ports: pixelLoad.requiredPorts,
      suggested_processor_name: processor.name,
      suggested_processor_ports: processor.ports,
      price_per_sqm: quote.product.pricePerSqm,
      panel_subtotal: totals.base.panelSubtotal,
      include_structure: quote.includeStructure,
      include_installation: quote.includeInstallation,
      include_processor: quote.includeProcessor,
      include_freight: quote.includeFreight,
      include_technical_visit: quote.includeTechnicalVisit,
      include_extended_warranty: quote.includeExtendedWarranty,
      structure_base_cost: totals.base.structureBaseCost,
      installation_base_cost: totals.base.installationBaseCost,
      processor_cost: quote.processorCost,
      freight_cost: quote.freightCost,
      technical_visit_cost: quote.technicalVisitCost,
      extended_warranty_cost: quote.extendedWarrantyCost,
      margin_percent: quote.marginPercent,
      internal_margin_value: totals.internalMarginValue,
      subtotal_with_margin: totals.subtotal,
      discount_percent: quote.discountPercent,
      discount_value: totals.discountValue,
      total: totals.total,
      notes: JSON.stringify({
        productImageDataUrl: quote.productImageDataUrl,
        screens: quote.screens,
      }),
    }).select("id").single();

    if (quoteError || !savedQuote) {
      return {
        ok: false,
        message: `Cliente salvo, mas a cotacao nao foi confirmada no Supabase: ${quoteError?.message ?? "sem retorno do banco"}`,
      };
    }

    await supabase.from("quote_events").insert({
      quote_id: quote.id,
      user_id: profile.id,
      event_type: "created",
      description: "Cotacao criada pela plataforma Boreal Quote Pro.",
    });

    return { ok: true, message: `Cotacao ${quote.quoteNumber} salva no Supabase e PDF gerado.` };
  },
  upsertProduct: async (product) => {
    const profile = get().profile;

    if (!supabase) {
      return { ok: false, message: "Produto nao foi salvo: Supabase nao esta configurado neste ambiente." };
    }

    if (profile?.role !== "master_admin") {
      return { ok: false, message: "Produto nao foi salvo: acesso exclusivo do Admin Master." };
    }

    const { error } = await supabase.from("products").upsert(productPayload(product), { onConflict: "technology,pixel_pitch" });
    if (error) {
      return { ok: false, message: `Produto nao foi salvo: Supabase recusou: ${error.message}` };
    }

    set((state) => ({
      products: state.products.some((item) => item.id === product.id)
        ? state.products.map((item) => (item.id === product.id ? product : item))
        : [product, ...state.products].sort((a, b) => `${a.technology} ${a.pixelPitch}`.localeCompare(`${b.technology} ${b.pixelPitch}`)),
    }));

    return { ok: true, message: "Produto salvo no Supabase." };
  },
  createPartner: async (partner, adminUserId, adminName) => {
    set((state) => ({
      partners: state.partners.some((item) => item.id === partner.id)
        ? state.partners.map((item) => (item.id === partner.id ? partner : item))
        : [partner, ...state.partners],
    }));

    if (!supabase) return { ok: true, message: "Parceiro salvo localmente." };

    const { data, error } = await supabase
      .from("partners")
      .upsert({
        id: partner.id,
        company_name: partner.companyName,
        trade_name: partner.tradeName,
        cnpj: partner.cnpj,
        email: partner.email,
        phone: partner.phone,
        city: partner.city,
        state: partner.state,
        status: partner.status,
      })
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, message: `Parceiro salvo localmente. Supabase recusou: ${error.message}` };

    if (adminUserId) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: adminUserId,
        partner_id: data?.id ?? partner.id,
        name: adminName || partner.tradeName || partner.companyName,
        email: partner.email,
        role: "partner_admin",
        can_view_company_quotes: true,
      });

      if (profileError) {
        return { ok: false, message: `Parceiro criado. Perfil do usuário não foi vinculado: ${profileError.message}` };
      }
    }

    return {
      ok: true,
      message: adminUserId
        ? "Parceiro e perfil de acesso vinculados."
        : "Parceiro criado. Crie o usuário no Supabase Auth e informe o ID para vincular o acesso.",
    };
  },
  resetData: () => set({ clients: [], quotes: [], partners: [], products: defaultProducts, syncError: "" }),
}));
