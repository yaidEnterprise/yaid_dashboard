"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronRight, ChevronLeft, Info, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ApiKeyModal } from "@/components/apps/api-key-modal";
import { createApp, type YaidAppWithKey } from "@/utils/apps-store";

const createAppSchema = z.object({
  name: z.string().min(1, "Informe o nome do app").max(50, "Máximo de 50 caracteres"),
  webhookUrl: z
    .string()
    .optional()
    .refine((v) => !v || v.trim() === "" || /^https:\/\//i.test(v.trim()), {
      message: "O webhook deve começar com https://",
    }),
});

type CreateAppFormValues = z.infer<typeof createAppSchema>;

export default function CreateAppPage() {
  const router = useRouter();
  const [createdApp, setCreatedApp] = useState<YaidAppWithKey | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateAppFormValues>({
    resolver: zodResolver(createAppSchema),
    defaultValues: { name: "", webhookUrl: "" },
  });

  const onSubmit = async (values: CreateAppFormValues) => {
    try {
      const webhookUrl = values.webhookUrl?.trim() ?? "";
      const app = await createApp({
        name: values.name.trim(),
        ...(webhookUrl ? { webhookUrl } : {}),
      });
      setCreatedApp(app);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao criar o app");
    }
  };

  const handleComplete = () => {
    toast.success("App criado com sucesso");
    router.push("/apps");
  };

  return (
    <>
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/apps" className="hover:text-text-primary">
          Apps
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
        <span className="text-text-primary">Novo app</span>
      </nav>

      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link
            href="/apps"
            className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Voltar para a lista
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Criar novo app</h1>
          <p className="max-w-2xl text-sm text-text-secondary">
            Configure um novo ponto de integração com a YaID. Após criar o app, você receberá uma
            API key que deve ser armazenada com segurança.
          </p>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-text-primary">Identificação</h2>
              <p className="text-xs text-text-secondary">Como esse app aparece para sua equipe.</p>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-xs font-medium text-text-secondary">
                  Nome do app
                </label>
                <input
                  id="name"
                  type="text"
                  maxLength={50}
                  placeholder="Ex.: Onboarding Produção"
                  className={`h-10 w-full rounded-md border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-trust/20 ${
                    errors.name ? "border-red-500 focus:border-red-500" : "border-border focus:border-trust"
                  }`}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
                <p className="text-[11px] text-text-tertiary">Visível apenas para sua equipe.</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-text-primary">Webhook</h2>
              <p className="text-xs text-text-secondary">
                URL HTTPS que receberá os eventos das solicitações (opcional).
              </p>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div className="space-y-1.5">
                <label htmlFor="webhookUrl" className="text-xs font-medium text-text-secondary">
                  URL do webhook
                </label>
                <input
                  id="webhookUrl"
                  type="url"
                  placeholder="https://api.suaempresa.com/yaid/hooks"
                  className={`h-10 w-full rounded-md border bg-surface px-3 font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-trust/20 ${
                    errors.webhookUrl
                      ? "border-red-500 focus:border-red-500"
                      : "border-border focus:border-trust"
                  }`}
                  {...register("webhookUrl")}
                />
                {errors.webhookUrl && (
                  <p className="text-sm text-red-600">{errors.webhookUrl.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/apps"
              className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting ? "Criando..." : "Criar app"}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-lg border border-trust/30 bg-trust/5 p-5">
            <div className="flex items-center gap-2 text-trust">
              <Info className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-wider">Sobre API keys</p>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-text-secondary">
              <li>• A API key é exibida uma única vez após a criação do app.</li>
              <li>• Formato: <code className="font-mono">app_id.secret</code> — guarde em um gerenciador de segredos.</li>
              <li>• Use o header <code className="font-mono">x-api-key</code> nas chamadas B2B.</li>
              <li>• Se perder a chave, será preciso criar um novo app.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-privacy/30 bg-privacy/5 p-5">
            <div className="flex items-center gap-2 text-privacy">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-wider">Privacidade</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              A YaID nunca compartilha documentos brutos. Cada app recebe apenas os atributos
              confirmados pelo usuário.
            </p>
          </div>
        </aside>
      </section>

      {createdApp && (
        <ApiKeyModal
          open
          appName={createdApp.name}
          apiKey={createdApp.apiKey}
          onComplete={handleComplete}
        />
      )}
    </>
  );
}
