import { PublicMixtape } from "@/components/public-mixtape";
export default async function MixtapePage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PublicMixtape id={id}/>}
