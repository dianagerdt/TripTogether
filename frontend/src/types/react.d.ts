// Type declarations for React when node_modules is not available locally
// This file allows TypeScript to work in IDE even without local node_modules

declare module 'react' {
  export function useState<T>(initial: T): [T, (value: T | ((prev: T) => T)) => void]
  export function useRef<T>(initial: T | null): RefObject<T>
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void
  export type ChangeEvent<T = HTMLInputElement> = SyntheticEvent<T>
  export type FormEvent<T = HTMLFormElement> = SyntheticEvent<T>
  export type MouseEvent<T = HTMLElement> = SyntheticEvent<T>
  export type FocusEvent<T = HTMLElement> = SyntheticEvent<T>
  
  export interface Component<P = {}, S = {}> {}
  export type ReactNode = any
  export namespace React {
    export type ReactNode = any
  }
  export type ComponentType<P = {}> = (props: P & { key?: string | number | null, children?: ReactNode }) => JSX.Element | null
  export interface RefObject<T> {
    current: T | null
  }
  export interface SyntheticEvent<T = Element> {
    target: T
    currentTarget: T
    preventDefault(): void
    stopPropagation(): void
  }
  
  // JSX types
  export namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any
    }
    interface Element extends ReactNode {}
    interface ElementClass {
      render(): ReactNode
    }
  }
  
  // React.createElement types
  export function createElement<P>(
    type: ComponentType<P> | string,
    props: P & { key?: string | number | null } | null,
    ...children: ReactNode[]
  ): JSX.Element
}

declare module 'next/navigation' {
  export function useParams(): Record<string, string | string[]>
  export function useRouter(): {
    push: (url: string) => void
    replace: (url: string) => void
    back: () => void
    refresh: () => void
  }
  export function useSearchParams(): URLSearchParams
}

declare module 'next/link' {
  import { ComponentType, ReactNode } from 'react'
  interface LinkProps {
    href: string
    children?: ReactNode
    className?: string
  }
  const Link: ComponentType<LinkProps>
  export default Link
}

declare module '@tanstack/react-query' {
  export function useQuery<T>(options: any): { data: T | undefined; isLoading: boolean; error: any }
  export function useMutation<T, V>(options: any): {
    mutate: (variables: V) => void
    mutateAsync: (variables: V) => Promise<T>
    isPending: boolean
    isError: boolean
    error: any
  }
  export function useQueryClient(): {
    invalidateQueries: (options: any) => void
  }
  export const QueryClientProvider: any
  export const QueryClient: any
}

declare module 'react-markdown' {
  interface ReactMarkdownProps {
    children?: string
    className?: string
  }
  const ReactMarkdown: React.ComponentType<ReactMarkdownProps>
  export default ReactMarkdown
}
