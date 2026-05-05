import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AbaUnidades from "@/components/admin/institucional/AbaUnidades";
import AbaGestoresGerais from "@/components/admin/institucional/AbaGestoresGerais";

export default function InstitucionaisPage() {
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-[Sora] text-2xl font-semibold text-[#5B3A8E]">
          Gerenciamento institucional
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Unidades, gestores de unidade e gestores gerais.
        </p>
      </header>

      <Tabs defaultValue="unidades" className="w-full">
        <TabsList className="h-auto bg-transparent p-0 gap-2 border-b w-full justify-start rounded-none">
          <TabsTrigger
            value="unidades"
            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 font-[Sora] text-muted-foreground shadow-none data-[state=active]:border-[#9b87f5] data-[state=active]:bg-transparent data-[state=active]:text-[#5B3A8E] data-[state=active]:shadow-none"
          >
            Unidades
          </TabsTrigger>
          <TabsTrigger
            value="gestores"
            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 font-[Sora] text-muted-foreground shadow-none data-[state=active]:border-[#9b87f5] data-[state=active]:bg-transparent data-[state=active]:text-[#5B3A8E] data-[state=active]:shadow-none"
          >
            Gestores Gerais
          </TabsTrigger>
        </TabsList>
        <TabsContent value="unidades" className="mt-6">
          <AbaUnidades />
        </TabsContent>
        <TabsContent value="gestores" className="mt-6">
          <AbaGestoresGerais />
        </TabsContent>
      </Tabs>
    </div>
  );
}
