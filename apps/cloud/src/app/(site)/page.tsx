// CLD-08: `/` is the landing page for everyone. The signed-in home is /cloud (CLD-20).
import { currentUser } from "../../auth";
import { Landing } from "../../components/Landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  return <Landing signedIn={(await currentUser()) !== null} />;
}
