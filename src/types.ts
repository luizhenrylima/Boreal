export type Role = "master_admin" | "partner_admin" | "seller";
export type Category = "indoor" | "outdoor";
export type QuoteStatus =
  | "draft"
  | "sent"
  | "negotiation"
  | "approved"
  | "lost"
  | "cancelled"
  | "technical_validation";

export type Product = {
  id: string;
  category: Category;
  technology: string;
  pixelPitch: string;
  pixelPitchMm: number;
  cabinetSize: string | null;
  pricePerSqm: number;
  supplier: "LED Wave";
  processorSystem: "NovaStar";
  lifespanHours: number;
  application: string;
  recommendedUse: string;
  imageDataUrl?: string;
  formats: Array<{ width: number; height: number; label?: string }>;
  technicalHighlights: string[];
  commercialDifferentials: string[];
};

export type Partner = {
  id: string;
  companyName: string;
  tradeName: string;
  cnpj: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  status: "active" | "inactive";
};

export type Processor = {
  name: string;
  brand: "NovaStar";
  ports: number;
  price: number;
  note?: string;
};

export type Client = {
  id: string;
  name: string;
  document: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  projectName: string;
  installationSite: string;
  notes: string;
  partnerId: string;
  createdBy: string;
};

export type PaymentOption = {
  id: string;
  label: string;
  cashAmount: number;
  downPayment: number;
  installmentCount: number;
  installmentAmount: number;
  notes: string;
};

export type Quote = {
  id: string;
  quoteNumber: string;
  client: Client;
  createdBy: string;
  product: Product;
  width: number;
  height: number;
  screens?: Array<{
    id: string;
    product: Product;
    width: number;
    height: number;
    label: string;
    structureCost?: number;
    installationCost?: number;
    processorCost?: number;
    freightCost?: number;
    technicalVisitCost?: number;
    extendedWarrantyCost?: number;
  }>;
  includeStructure: boolean;
  includeInstallation: boolean;
  includeProcessor: boolean;
  includeFreight: boolean;
  includeTechnicalVisit: boolean;
  includeExtendedWarranty: boolean;
  structureBaseCost?: number;
  installationBaseCost?: number;
  processorCost: number;
  freightCost: number;
  technicalVisitCost: number;
  extendedWarrantyCost: number;
  marginPercent: number;
  discountPercent: number;
  status: QuoteStatus;
  createdAt: string;
  productImageDataUrl?: string;
  paymentOptions?: PaymentOption[];
};
