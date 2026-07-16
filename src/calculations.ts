import { processors, servicePricing } from "./data";
import type { Category, Processor } from "./types";

export const PIXELS_PER_PORT = 650000;

export function calculateArea(width: number, height: number) {
  return Number((width * height).toFixed(4));
}

export function calculatePanelValue(area: number, pricePerSqm: number) {
  return Number((area * pricePerSqm).toFixed(2));
}

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function detectFormat(width: number, height: number) {
  const ratio = width / height;
  if (ratio >= 1.72 && ratio <= 1.82) return "16:9";
  if (ratio >= 2.2 && ratio <= 2.45) return "Ultrawide";
  if (ratio > 2.45) return "Cinema / Super Ultrawide";
  return "Formato Especial";
}

export function getPixelPitchNumber(pixelPitch: string): number {
  return Number(pixelPitch.replace("P", "").replace("p", "").replace(",", "."));
}

export function calculatePixelLoad(widthM: number, heightM: number, pixelPitchMm: number) {
  const pixelsWidth = Math.ceil((widthM * 1000) / pixelPitchMm);
  const pixelsHeight = Math.ceil((heightM * 1000) / pixelPitchMm);
  const totalPixels = pixelsWidth * pixelsHeight;
  const requiredPorts = Math.ceil(totalPixels / PIXELS_PER_PORT);

  return {
    pixelsWidth,
    pixelsHeight,
    totalPixels,
    requiredPorts,
  };
}

export function suggestProcessor(requiredPorts: number): Processor {
  const processor = processors.find((item) => item.ports >= requiredPorts);

  if (!processor) {
    return {
      name: "Projeto especial",
      brand: "NovaStar",
      ports: requiredPorts,
      price: 0,
      note: "Quantidade de pixels acima da capacidade padrão. Solicitar validação técnica.",
    };
  }

  return processor;
}

export function applyMargin(value: number, marginPercent: number) {
  return Number((value * (1 + marginPercent / 100)).toFixed(2));
}

export function calculateQuoteTotal({
  area,
  pricePerSqm,
  category,
  includeStructure,
  includeInstallation,
  includeProcessor,
  includeFreight,
  includeTechnicalVisit,
  includeExtendedWarranty,
  structureBaseCost: customStructureBaseCost,
  installationBaseCost: customInstallationBaseCost,
  processorCost,
  freightCost,
  technicalVisitCost,
  extendedWarrantyCost,
  marginPercent,
  discountPercent,
}: {
  area: number;
  pricePerSqm: number;
  category: Category;
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
}) {
  const panelSubtotal = area * pricePerSqm;
  const defaultStructureBaseCost =
    category === "indoor"
      ? area * servicePricing.indoorStructurePerSqm
      : area * servicePricing.outdoorStructurePerSqm;
  const defaultInstallationBaseCost = area * servicePricing.installationPerSqm;
  const structureBaseCost = includeStructure
    ? Number((customStructureBaseCost ?? defaultStructureBaseCost).toFixed(2))
    : 0;
  const installationBaseCost = includeInstallation
    ? Number((customInstallationBaseCost ?? defaultInstallationBaseCost).toFixed(2))
    : 0;

  const base = {
    panelSubtotal,
    structureBaseCost,
    installationBaseCost,
    processorCost: includeProcessor ? processorCost : 0,
    freightCost: includeFreight ? freightCost : 0,
    technicalVisitCost: includeTechnicalVisit ? technicalVisitCost : 0,
    extendedWarrantyCost: includeExtendedWarranty ? extendedWarrantyCost : 0,
  };

  const withMargin = {
    panel: applyMargin(base.panelSubtotal, marginPercent),
    structure: applyMargin(base.structureBaseCost, marginPercent),
    installation: applyMargin(base.installationBaseCost, marginPercent),
    processor: applyMargin(base.processorCost, marginPercent),
    freight: applyMargin(base.freightCost, marginPercent),
    technicalVisit: applyMargin(base.technicalVisitCost, marginPercent),
    extendedWarranty: applyMargin(base.extendedWarrantyCost, marginPercent),
  };

  const subtotal = Object.values(withMargin).reduce((sum, value) => sum + value, 0);
  const discountValue = subtotal * (discountPercent / 100);
  const total = subtotal - discountValue;

  return {
    base,
    withMargin,
    subtotal: Number(subtotal.toFixed(2)),
    discountValue: Number(discountValue.toFixed(2)),
    total: Number(total.toFixed(2)),
    internalMarginValue: Number((subtotal - Object.values(base).reduce((sum, value) => sum + value, 0)).toFixed(2)),
  };
}

export type CommercialScreen = {
  area: number;
  pricePerSqm: number;
  category: Category;
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
};

export function calculateProjectTotal(items: CommercialScreen[], marginPercent: number, discountPercent: number) {
  const itemTotals = items.map((item) => calculateQuoteTotal({ ...item, marginPercent, discountPercent: 0 }));
  const base = itemTotals.reduce((total, item) => ({
    panelSubtotal: total.panelSubtotal + item.base.panelSubtotal,
    structureBaseCost: total.structureBaseCost + item.base.structureBaseCost,
    installationBaseCost: total.installationBaseCost + item.base.installationBaseCost,
    processorCost: total.processorCost + item.base.processorCost,
    freightCost: total.freightCost + item.base.freightCost,
    technicalVisitCost: total.technicalVisitCost + item.base.technicalVisitCost,
    extendedWarrantyCost: total.extendedWarrantyCost + item.base.extendedWarrantyCost,
  }), { panelSubtotal: 0, structureBaseCost: 0, installationBaseCost: 0, processorCost: 0, freightCost: 0, technicalVisitCost: 0, extendedWarrantyCost: 0 });
  const withMargin = itemTotals.reduce((total, item) => ({
    panel: total.panel + item.withMargin.panel,
    structure: total.structure + item.withMargin.structure,
    installation: total.installation + item.withMargin.installation,
    processor: total.processor + item.withMargin.processor,
    freight: total.freight + item.withMargin.freight,
    technicalVisit: total.technicalVisit + item.withMargin.technicalVisit,
    extendedWarranty: total.extendedWarranty + item.withMargin.extendedWarranty,
  }), { panel: 0, structure: 0, installation: 0, processor: 0, freight: 0, technicalVisit: 0, extendedWarranty: 0 });
  const subtotal = Object.values(withMargin).reduce((sum, value) => sum + value, 0);
  const discountValue = subtotal * (discountPercent / 100);
  const baseTotal = Object.values(base).reduce((sum, value) => sum + value, 0);
  return {
    items: itemTotals,
    base,
    withMargin,
    subtotal: moneyValue(subtotal),
    discountValue: moneyValue(discountValue),
    total: moneyValue(subtotal - discountValue),
    internalMarginValue: moneyValue(subtotal - baseTotal),
  };
}

function moneyValue(value: number) {
  return Number(value.toFixed(2));
}

export function normalizeDocument(document: string) {
  return document.replace(/\D/g, "");
}

export function similarName(a: string, b: string) {
  const left = a.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const right = b.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return left.length > 4 && right.includes(left.slice(0, Math.min(left.length, 8)));
}
