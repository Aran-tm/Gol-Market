// Fetch a wallet's NFTs via the Metaplex DAS `getAssetsByOwner` method.
// Requires a DAS-capable RPC (Helius/Triton) in VITE_SOLANA_RPC — the public RPC
// used for plain wallet calls does NOT support DAS.

const RPC = import.meta.env.VITE_SOLANA_RPC as string | undefined;

export interface NftItem {
  id: string;
  name: string;
  image: string;
}

interface DasFile {
  uri?: string;
  cdn_uri?: string;
  mime?: string;
}
interface DasItem {
  id: string;
  content?: {
    links?: { image?: string };
    files?: DasFile[];
    metadata?: { name?: string };
  };
}

// Curated gallery — real, currently-listed NFTs from popular Solana collections
// (pulled from Magic Eden's public listings, hotlinked from their permanent Arweave/CDN
// storage). Shown as a fallback so every wallet has NFTs to pick from, even ones that
// own none — the live fetchNfts() below is tried first.
export const CURATED_NFTS: NftItem[] = [
  { id: "curated-okb-1", name: "Okay Bear #5607", image: "https://arweave.net/1N_QyFdh2h9kzdzHQLgeecxnXVG88bHhA04bxLCpqPQ" },
  { id: "curated-okb-2", name: "Okay Bear #1359", image: "https://arweave.net/BJzfXp114b-yfNsDvosLeAlCxiVK-Hvf8N8V3pQ_P1I" },
  { id: "curated-okb-3", name: "Okay Bear #452", image: "https://arweave.net/GLXLrfCt77uh1JAzc9AqlnVO5HNXPGxKg3HvyFEIQxE" },
  { id: "curated-dg-1", name: "DeGod #4975", image: "https://metadata.degods.com/g/4974-dead-rm.png" },
  { id: "curated-dg-2", name: "DeGod #2499", image: "https://metadata.degods.com/g/2498-dead-rm.png" },
  { id: "curated-dg-3", name: "DeGod #8930", image: "https://metadata.degods.com/g/8929-dead-rm.png" },
  { id: "curated-smb-1", name: "SMB #2058", image: "https://arweave.net/A6_moeCwY2FKlV4_FxY5c51ru7BtFI5XiR8srk-WIBc" },
  { id: "curated-smb-2", name: "SMB #2672", image: "https://arweave.net/zaY5x6A_SiVoo6xu4MlKfHGTpTr6lNmY4fpYkz4TogY" },
  { id: "curated-smb-3", name: "SMB #4441", image: "https://arweave.net/aYhI185Tm5yCg2XCRY6UfjL9ACw2SNFO5Z-wuif4Yas" },
  { id: "curated-clay-1", name: "Claynosaurz #3881", image: "https://storage.claynosaurz.com/claynosaurz/animated/3881" },
  { id: "curated-clay-2", name: "Claynosaurz #2122", image: "https://storage.claynosaurz.com/claynosaurz/animated/2122" },
  { id: "curated-clay-3", name: "Claynosaurz #907", image: "https://storage.claynosaurz.com/claynosaurz/animated/907" },
  { id: "curated-mad-1", name: "Mad Lads #4998", image: "https://madlads.s3.us-west-2.amazonaws.com/images/4998.png" },
  { id: "curated-mad-2", name: "Mad Lads #1047", image: "https://madlads.s3.us-west-2.amazonaws.com/images/1047.png" },
  { id: "curated-mad-3", name: "Mad Lads #3283", image: "https://madlads.s3.us-west-2.amazonaws.com/images/3283.png" },
];

/** True if a DAS-capable RPC looks configured (heuristic on the URL). */
export function hasNftRpc(): boolean {
  return !!RPC && /helius|triton|das|quiknode|quicknode/i.test(RPC);
}

/** Fetch image NFTs owned by `owner`. Throws with a helpful message if no DAS RPC. */
export async function fetchNfts(owner: string): Promise<NftItem[]> {
  if (!hasNftRpc()) {
    throw new Error("Set VITE_SOLANA_RPC to a Helius/DAS RPC to load your NFTs.");
  }
  const res = await fetch(RPC!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "golmarket",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: owner,
        page: 1,
        limit: 200,
        displayOptions: { showFungible: false, showZeroBalance: false },
      },
    }),
  });
  if (!res.ok) throw new Error(`RPC error ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "DAS request failed");

  const items: DasItem[] = json.result?.items ?? [];
  return items
    .map((it): NftItem => {
      const c = it.content ?? {};
      const image =
        c.links?.image ??
        c.files?.find((f) => (f.mime ?? "").startsWith("image"))?.cdn_uri ??
        c.files?.find((f) => (f.mime ?? "").startsWith("image"))?.uri ??
        c.files?.[0]?.uri ??
        "";
      return { id: it.id, name: c.metadata?.name ?? "NFT", image };
    })
    .filter((n) => !!n.image);
}
