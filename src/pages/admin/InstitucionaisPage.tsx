import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AbaContratantes from "@/components/admin/institucional/AbaContratantes";
import AbaUnidades from "@/components/admin/institucional/AbaUnidades";
import AbaGestoresUnidade from "@/components/admin/institucional/AbaGestoresUnidade";
import AbaProfissionais from "@/components/admin/institucional/AbaProfissionais";
import AbaGestoresGerais from "@/components/admin/institucional/AbaGestoresGerais";

export default function InstitucionaisPage() {
  const { t } = useTranslation();
  const [aba, setAba] = useState("contratantes");

  const triggerCls =
    "rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 font-[Sora] text-muted-foreground shadow-none data-[state=active]:border-[#9b87f5] data-[state=active]:bg-transparent data-[state=active]:text-[#5B3A8E] data-[state=active]:shadow-none";

  const irParaContratantes = () => setAba("contratantes");

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-[Sora] text-2xl font-semibold text-[#5B3A8E]">
          {t("admin.institucionais.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.institucionais.subtitle")}
        </p>
      </header>

      <Tabs value={aba} onValueChange={setAba} className="w-full">
        <TabsList className="h-auto bg-transparent p-0 gap-2 border-b w-full justify-start rounded-none">
          <TabsTrigger value="contratantes" className={triggerCls}>{t("admin.institucionais.tabContratantes")}</TabsTrigger>
          <TabsTrigger value="unidades" className={triggerCls}>{t("admin.institucionais.tabUnidades")}</TabsTrigger>
          <TabsTrigger value="gestores-unidade" className={triggerCls}>{t("admin.institucionais.tabGestoresUnidade")}</TabsTrigger>
          <TabsTrigger value="profissionais" className={triggerCls}>{t("admin.institucionais.tabProfissionais")}</TabsTrigger>
          <TabsTrigger value="gestores" className={triggerCls}>{t("admin.institucionais.tabGestoresGerais")}</TabsTrigger>
        </TabsList>
        <TabsContent value="contratantes" className="mt-6"><AbaContratantes /></TabsContent>
        <TabsContent value="unidades" className="mt-6"><AbaUnidades onIrParaContratantes={irParaContratantes} /></TabsContent>
        <TabsContent value="gestores-unidade" className="mt-6"><AbaGestoresUnidade /></TabsContent>
        <TabsContent value="profissionais" className="mt-6"><AbaProfissionais /></TabsContent>
        <TabsContent value="gestores" className="mt-6"><AbaGestoresGerais /></TabsContent>
      </Tabs>
    </div>
  );
}
