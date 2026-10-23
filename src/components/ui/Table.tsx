import { cn } from '@/lib/utils'

/**
 * Table primitives. The wrapper scrolls horizontally so dashboard tables never
 * cause page-level overflow on small screens.
 */

export function Table({ className, children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="table-scroll">
      <table className={cn('w-full min-w-[640px] border-collapse text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  )
}

export function THead({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('border-b border-ink-200 bg-ink-50/60', className)} {...props}>
      {children}
    </thead>
  )
}

export function TBody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('divide-y divide-ink-100', className)} {...props}>
      {children}
    </tbody>
  )
}

export function TR({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { 'data-state'?: string }) {
  return (
    <tr className={cn('transition-colors hover:bg-ink-50/60 focus-within:bg-ink-50/80', className)} {...props}>
      {children}
    </tr>
  )
}

export function TH({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

export function TD({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3.5 align-middle text-ink-700', className)} {...props}>
      {children}
    </td>
  )
}

/** Simple definition-list style "key: value" pairs for detail panels. */
export function DataList({ items, className }: { items: Array<{ label: string; value: React.ReactNode }>; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{item.label}</dt>
          <dd className="mt-1 text-sm text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
