import AdminScreen from "./screen";
import "./admin.css";

export const metadata = { title: "Administração", robots: { index: false, follow: false } };

export default function Page() {
  return <AdminScreen />;
}
