declare module "next" {
  export type Metadata = import("next/dist/lib/metadata/types/metadata-interface").Metadata;
  export type Viewport = import("next/dist/lib/metadata/types/metadata-interface").Viewport;
  const next: any;
  export default next;
}

declare module "next/font/google" {
  export const Cormorant_Garamond: any;
  export const Karla: any;
  export const Parisienne: any;
}

declare module "next/headers" {
  export function cookies(): Promise<{
    getAll(): Array<{ name: string; value: string }>;
    set(name: string, value: string, options?: any): void;
    delete(name: string): void;
  }>;
  export function headers(): Promise<Headers>;
}

declare module "next/link" {
  import { ComponentProps, ElementType, ReactNode } from "react";
  export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string;
    children?: ReactNode;
  }
  const Link: (props: LinkProps) => JSX.Element;
  export default Link;
}

declare module "next/navigation" {
  export function useRouter(): {
    push(href: string): void;
    replace(href: string): void;
    prefetch(href: string): void;
    back(): void;
    forward(): void;
    refresh(): void;
  };
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  export function useParams(): Record<string, string | string[]>;
}

declare module "next/navigation.js" {
  export function useRouter(): any;
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  export function useParams(): Record<string, string | string[]>;
}

declare module "next/dist/lib/metadata/types/metadata-interface.js" {
  export type ResolvingMetadata = Promise<import("next").Metadata>;
  export type ResolvingViewport = Promise<import("next").Viewport>;
}

declare module "next/types.js" {
  export type ResolvingMetadata = Promise<import("next").Metadata>;
  export type ResolvingViewport = Promise<import("next").Viewport>;
}

declare module "next/server" {
  export type NextRequest = import("next/dist/server/web/spec-extension/request").NextRequest;
  export const NextResponse: typeof import("next/dist/server/web/spec-extension/response").NextResponse;
}

declare module "next/server.js" {
  export type NextRequest = import("next/dist/server/web/spec-extension/request").NextRequest;
  export const NextResponse: typeof import("next/dist/server/web/spec-extension/response").NextResponse;
}

declare module "lucide-react" {
  export const CheckCircle2: React.ComponentType<{ className?: string }>;
  export const ShieldCheck: React.ComponentType<{ className?: string }>;
  export const Database: React.ComponentType<{ className?: string }>;
  export const Layers: React.ComponentType<{ className?: string }>;
  export const Sparkles: React.ComponentType<{ className?: string }>;
  export const ArrowUpRight: React.ComponentType<{ className?: string }>;
  export const Terminal: React.ComponentType<{ className?: string }>;
}
