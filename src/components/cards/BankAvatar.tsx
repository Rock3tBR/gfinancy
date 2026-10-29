import { useState } from "react";

export type BankOption = {
  id: string;
  label: string;
  shortLabel: string;
  logoPath: string;
  color: string;
  aliases: string[];
};

export const BANKS: BankOption[] = [
  {
    id: "santander",
    label: "Santander",
    shortLabel: "SAN",
    logoPath: "/banks/santander.svg",
    color: "#EF4444",
    aliases: ["santander", "sx", "free", "way"],
  },
  {
    id: "nubank",
    label: "Nubank",
    shortLabel: "NU",
    logoPath: "/banks/nubank.svg",
    color: "#8A05BE",
    aliases: ["nubank", "nu bank", "nu", "roxinho"],
  },
  {
    id: "itau",
    label: "Itaú",
    shortLabel: "ITA",
    logoPath: "/banks/itau.svg",
    color: "#FF7A00",
    aliases: ["itaú", "itau", "personnalité", "personnalite", "uniclass"],
  },
  {
    id: "inter",
    label: "Inter",
    shortLabel: "INT",
    logoPath: "/banks/inter.svg",
    color: "#FF7A00",
    aliases: ["inter", "banco inter"],
  },
  {
    id: "bradesco",
    label: "Bradesco",
    shortLabel: "BRA",
    logoPath: "/banks/bradesco.svg",
    color: "#E30613",
    aliases: ["bradesco"],
  },
  {
    id: "bb",
    label: "Banco do Brasil",
    shortLabel: "BB",
    logoPath: "/banks/bb.svg",
    color: "#FDE047",
    aliases: ["banco do brasil", "bb", "ourocard"],
  },
  {
    id: "caixa",
    label: "Caixa",
    shortLabel: "CX",
    logoPath: "/banks/caixa.svg",
    color: "#2563EB",
    aliases: ["caixa"],
  },
  {
    id: "c6",
    label: "C6 Bank",
    shortLabel: "C6",
    logoPath: "/banks/c6.svg",
    color: "#111827",
    aliases: ["c6", "c6 bank"],
  },
  {
    id: "xp",
    label: "XP",
    shortLabel: "XP",
    logoPath: "/banks/xp.svg",
    color: "#111827",
    aliases: ["xp", "xp visa"],
  },
  {
    id: "picpay",
    label: "PicPay",
    shortLabel: "PP",
    logoPath: "/banks/picpay.svg",
    color: "#22C55E",
    aliases: ["picpay", "pic pay"],
  },
  {
    id: "mercadopago",
    label: "Mercado Pago",
    shortLabel: "MP",
    logoPath: "/banks/mercadopago.svg",
    color: "#00AEEF",
    aliases: ["mercado pago", "mercadopago", "mercado livre", "meli"],
  },
  {
    id: "outro",
    label: "Outro banco",
    shortLabel: "CB",
    logoPath: "",
    color: "#D9FF66",
    aliases: [],
  },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function getBankById(bankId: string) {
  return BANKS.find((bank) => bank.id === bankId) ?? BANKS[BANKS.length - 1];
}

export function inferBankFromCardName(cardName: string) {
  const normalizedName = normalizeText(cardName);

  return (
    BANKS.find((bank) =>
      bank.aliases.some((alias) => normalizedName.includes(normalizeText(alias))),
    ) ?? getBankById("outro")
  );
}

export function BankAvatar({ bank }: { bank: BankOption }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(bank.logoPath) && !imageFailed;

  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045]"
      style={{
        boxShadow: `0 0 28px ${bank.color}30`,
      }}
    >
      {showImage ? (
        <img
          src={bank.logoPath}
          alt={bank.label}
          className="h-9 w-9 object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-xs font-black text-white"
          style={{
            background: `linear-gradient(135deg, ${bank.color}, #1A1A1A)`,
          }}
        >
          {bank.shortLabel}
        </div>
      )}
    </div>
  );
}
