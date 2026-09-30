import { Check, ChevronDown, Pencil, ScanSearch, SquarePen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Props = {
  editing: boolean
  onEditingChange: (editing: boolean) => void
  /** Eye-flow points can be edited right now (markers shown, note has a recording) */
  canEditFlow: boolean
}

function ItemText({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="flex flex-col">
      <span>{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </span>
  )
}

/**
 * Data-correction tools, kept apart from the view controls: in-place editing of eye-flow points,
 * and (dev server only) the touch extraction tool.
 */
export function EditMenu({ editing, onEditingChange, canEditFlow }: Props) {
  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-lg border border-primary/30 bg-background/95 p-1 pl-2.5 text-sm shadow-sm backdrop-blur">
        <Pencil className="size-3.5 text-primary" />
        <span className="font-medium">Editing eye flow</span>
        <Button size="xs" className="ml-1.5" onClick={() => onEditingChange(false)}>
          <Check />
          Done
        </Button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="bg-background/95 shadow-sm backdrop-blur"
          />
        }
      >
        <SquarePen />
        Edit
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Correct the data</DropdownMenuLabel>
          <DropdownMenuItem disabled={!canEditFlow} onClick={() => onEditingChange(true)}>
            <Pencil />
            <ItemText
              title="Eye-flow points"
              hint={
                canEditFlow
                  ? 'Move, add or reorder points on this note'
                  : 'Show eye flow as markers on a note with a recording'
              }
            />
          </DropdownMenuItem>
          {import.meta.env.DEV && (
            <DropdownMenuItem
              onClick={() => {
                location.hash = '#/touch/extract'
              }}
            >
              <ScanSearch />
              <ItemText title="Touch extraction" hint="Re-detect ink from the UV photos" />
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <p className="px-1.5 py-1 text-xs text-muted-foreground">
          Saving writes to the project, so it only works while running locally.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
