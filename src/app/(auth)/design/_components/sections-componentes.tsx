'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Plus, Bell, Trash2, Star, Settings, Pencil, Copy, ExternalLink,
} from 'lucide-react'
import type { EventStatus } from '@/types/database.types'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount,
} from '@/components/ui/avatar'
import {
  Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Calendar } from '@/components/ui/calendar'
import { InfoPopover } from '@/components/ui/info-popover'
import { DateInput } from '@/components/ui/date-input'
import {
  InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton, InputGroupText,
} from '@/components/ui/input-group'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription,
} from '@/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  CommandDialog, Command, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from '@/components/ui/command'

import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { EventStatusBadge } from '@/components/shared/event-status-badge'
import { ContractSignedBadge } from '@/components/shared/contract-signed-badge'
import { FilterChip } from '@/components/shared/filter-chip'
import { UnitChip } from '@/components/shared/unit-chip'
import { UserAvatar } from '@/components/shared/user-avatar'
import { PageHeader } from '@/components/shared/page-header'
import { PlaceholderPage } from '@/components/shared/placeholder-page'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PhotoThumb, PhotoDropZone } from '@/components/shared/photo-upload'
import { FileDropZone } from '@/components/shared/file-upload'
import { PhotoLightbox } from '@/components/shared/photo-lightbox'

import { ShowcaseSection, ShowcaseCard, Demo } from './primitives'

const SAMPLE_IMG = (label: string, hex: string) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400'%3E%3Crect width='600' height='400' fill='%23${hex}'/%3E%3Ctext x='50%25' y='50%25' fill='white' font-size='40' text-anchor='middle' dominant-baseline='middle'%3E${label}%3C/text%3E%3C/svg%3E`

const LIGHTBOX_PHOTOS = [
  { id: '1', signedUrl: SAMPLE_IMG('Foto 1', '7C8D78'), label: 'Montagem — frente' },
  { id: '2', signedUrl: SAMPLE_IMG('Foto 2', 'C97B5A'), label: 'Montagem — mesa' },
]

const BTN_VARIANTS = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const
const BADGE_VARIANTS = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const
const EVENT_STATUSES: EventStatus[] = [
  'pending', 'confirmed', 'preparing', 'in_progress', 'finished', 'post_event', 'lost',
]
const SELECT_LABELS: Record<string, string> = { pinheiros: 'Pinheiros', moema: 'Moema', ambas: 'Ambas' }

export function ComponentesUI() {
  const [sel, setSel] = useState('pinheiros')
  const [date, setDate] = useState('')
  const [day, setDay] = useState<Date | undefined>(new Date())
  const [cmdOpen, setCmdOpen] = useState(false)

  return (
    <ShowcaseSection
      id="ui"
      title="Componentes — ui/"
      description="Primitivos do design system (@base-ui). Cada um em suas variantes e estados."
    >
      {/* Button */}
      <ShowcaseCard title="Button" hint="variant × size × estados">
        <div className="space-y-4">
          <Demo label="variant">
            {BTN_VARIANTS.map((v) => (
              <Button key={v} variant={v}>{v}</Button>
            ))}
          </Demo>
          <Demo label="size">
            <Button size="xs">xs</Button>
            <Button size="sm">sm</Button>
            <Button size="default">default</Button>
            <Button size="lg">lg</Button>
            <Button size="icon" aria-label="ícone"><Plus /></Button>
            <Button size="icon-sm" variant="outline" aria-label="ícone"><Pencil /></Button>
          </Demo>
          <Demo label="estados / com ícone">
            <Button disabled>disabled</Button>
            <Button variant="outline"><Plus />Novo</Button>
            <Button variant="destructive"><Trash2 />Excluir</Button>
          </Demo>
        </div>
      </ShowcaseCard>

      {/* Badge */}
      <ShowcaseCard title="Badge" hint="variant (≠ classes .badge-{cor})">
        <Demo>
          {BADGE_VARIANTS.map((v) => (
            <Badge key={v} variant={v}>{v}</Badge>
          ))}
        </Demo>
      </ShowcaseCard>

      {/* Inputs */}
      <ShowcaseCard title="Input · Textarea · Label">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="d-in">Padrão</Label>
            <Input id="d-in" placeholder="Digite algo..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-in-d">Desabilitado</Label>
            <Input id="d-in-d" placeholder="Indisponível" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-in-e">Erro (aria-invalid)</Label>
            <Input id="d-in-e" defaultValue="valor inválido" aria-invalid />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-ta">Textarea</Label>
            <Textarea id="d-ta" placeholder="Observações..." />
          </div>
        </div>
      </ShowcaseCard>

      {/* Select / Checkbox / Switch / DateInput */}
      <ShowcaseCard title="Select · Checkbox · Switch · DateInput">
        <div className="flex flex-wrap items-end gap-6">
          <div className="space-y-1.5">
            <Label>Select</Label>
            <Select value={sel} onValueChange={(v) => setSel(v ?? 'pinheiros')}>
              <SelectTrigger className="w-44"><SelectValue>{SELECT_LABELS[sel]}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="pinheiros">Pinheiros</SelectItem>
                <SelectItem value="moema">Moema</SelectItem>
                <SelectItem value="ambas">Ambas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Label className="gap-2"><Checkbox defaultChecked /> Checkbox</Label>
          <Label className="gap-2"><Checkbox /> Sem marcar</Label>
          <div className="flex items-center gap-2"><Switch defaultChecked /> <span className="text-sm">Switch</span></div>
          <div className="flex items-center gap-2"><Switch size="sm" /> <span className="text-sm">sm</span></div>
          <div className="space-y-1.5">
            <Label htmlFor="d-date">DateInput</Label>
            <DateInput id="d-date" value={date} onChange={setDate} className="w-44" />
          </div>
        </div>
      </ShowcaseCard>

      {/* InputGroup */}
      <ShowcaseCard title="InputGroup" hint="addons inline">
        <div className="max-w-sm space-y-3">
          <InputGroup>
            <InputGroupAddon><Star /></InputGroupAddon>
            <InputGroupInput placeholder="Com ícone à esquerda" />
          </InputGroup>
          <InputGroup>
            <InputGroupInput placeholder="Com botão à direita" />
            <InputGroupAddon align="inline-end">
              <InputGroupButton>Buscar</InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <InputGroup>
            <InputGroupAddon><InputGroupText>R$</InputGroupText></InputGroupAddon>
            <InputGroupInput placeholder="0,00" inputMode="decimal" />
          </InputGroup>
        </div>
      </ShowcaseCard>

      {/* Tabs */}
      <ShowcaseCard title="Tabs" hint="variant line (padrão) e default (pills)">
        <div className="space-y-6">
          <Tabs defaultValue="a">
            <TabsList>
              <TabsTrigger value="a">Visão Geral</TabsTrigger>
              <TabsTrigger value="b">Detalhes</TabsTrigger>
              <TabsTrigger value="c" disabled>Bloqueada</TabsTrigger>
            </TabsList>
            <TabsContent value="a"><p className="text-sm text-muted-foreground">Conteúdo da aba A (line).</p></TabsContent>
            <TabsContent value="b"><p className="text-sm text-muted-foreground">Conteúdo da aba B.</p></TabsContent>
          </Tabs>
          <Tabs defaultValue="x">
            <TabsList variant="default">
              <TabsTrigger value="x">Pill 1</TabsTrigger>
              <TabsTrigger value="y">Pill 2</TabsTrigger>
            </TabsList>
            <TabsContent value="x"><p className="text-sm text-muted-foreground">Conteúdo pill 1.</p></TabsContent>
            <TabsContent value="y"><p className="text-sm text-muted-foreground">Conteúdo pill 2.</p></TabsContent>
          </Tabs>
        </div>
      </ShowcaseCard>

      {/* Avatar */}
      <ShowcaseCard title="Avatar · UserAvatar">
        <Demo>
          <Avatar size="sm"><AvatarFallback>BC</AvatarFallback></Avatar>
          <Avatar><AvatarFallback>BC</AvatarFallback></Avatar>
          <Avatar size="lg"><AvatarImage src={SAMPLE_IMG('B', '7C8D78')} alt="avatar" /><AvatarFallback>BC</AvatarFallback></Avatar>
          <AvatarGroup>
            <Avatar><AvatarFallback>AB</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>CD</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>EF</AvatarFallback></Avatar>
            <AvatarGroupCount>+3</AvatarGroupCount>
          </AvatarGroup>
          <UserAvatar name="Bruno Casaletti" />
          <UserAvatar name="Maria Silva" size="lg" />
        </Demo>
      </ShowcaseCard>

      {/* Table */}
      <ShowcaseCard title="Table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedora</TableHead>
              <TableHead>Festas</TableHead>
              <TableHead className="text-right">Receita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow><TableCell>Carolina</TableCell><TableCell>12</TableCell><TableCell className="text-right">R$ 84.000</TableCell></TableRow>
            <TableRow data-state="selected"><TableCell>Bruna (selecionada)</TableCell><TableCell>9</TableCell><TableCell className="text-right">R$ 61.500</TableCell></TableRow>
            <TableRow><TableCell>Raphaela</TableCell><TableCell>7</TableCell><TableCell className="text-right">R$ 48.200</TableCell></TableRow>
          </TableBody>
          <TableFooter>
            <TableRow><TableCell>Total</TableCell><TableCell>28</TableCell><TableCell className="text-right">R$ 193.700</TableCell></TableRow>
          </TableFooter>
        </Table>
      </ShowcaseCard>

      {/* Progress / ProgressRing / Separator / ScrollArea */}
      <div className="grid gap-6 md:grid-cols-2">
        <ShowcaseCard title="Progress · ProgressRing">
          <div className="space-y-4">
            <Progress value={35} />
            <Progress value={70} />
            <Demo label="ProgressRing (0 / 25 / 50 / 75 / 100)">
              {[0, 25, 50, 75, 100].map((p) => (
                <ProgressRing key={p} pct={p} label />
              ))}
            </Demo>
          </div>
        </ShowcaseCard>
        <ShowcaseCard title="Separator · ScrollArea">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span>Item A</span><Separator orientation="vertical" className="h-4" /><span>Item B</span>
            </div>
            <Separator />
            <ScrollArea className="h-28 rounded-md border border-border-default p-2">
              <div className="space-y-1 text-sm text-muted-foreground">
                {Array.from({ length: 12 }).map((_, i) => <p key={i}>Linha rolável {i + 1}</p>)}
              </div>
            </ScrollArea>
          </div>
        </ShowcaseCard>
      </div>

      {/* Calendar + InfoPopover */}
      <div className="grid gap-6 md:grid-cols-2">
        <ShowcaseCard title="Calendar">
          <Calendar mode="single" selected={day} onSelect={setDay} />
        </ShowcaseCard>
        <ShowcaseCard title="InfoPopover">
          <div className="flex items-center gap-2 text-sm">
            Antecedência média de reserva
            <InfoPopover>
              <p className="text-sm">Dias entre a criação do lead e a data da festa. Média ponderada do período selecionado.</p>
            </InfoPopover>
          </div>
        </ShowcaseCard>
      </div>

      {/* Skeleton */}
      <ShowcaseCard title="Skeleton">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </ShowcaseCard>

      {/* Overlays interativos */}
      <ShowcaseCard title="Overlays interativos" hint="clique para abrir">
        <Demo>
          {/* Dialog */}
          <Dialog>
            <DialogTrigger render={<Button variant="outline">Dialog</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Título do diálogo</DialogTitle>
                <DialogDescription>Descrição curta do que este diálogo faz.</DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Conteúdo do corpo.</p>
              <DialogFooter showCloseButton />
            </DialogContent>
          </Dialog>

          {/* Sheets — 4 lados */}
          {(['right', 'left', 'top', 'bottom'] as const).map((side) => (
            <Sheet key={side}>
              <SheetTrigger render={<Button variant="outline">Sheet {side}</Button>} />
              <SheetContent side={side}>
                <SheetHeader>
                  <SheetTitle>Sheet ({side})</SheetTitle>
                  <SheetDescription>Painel lateral deslizante.</SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
          ))}

          {/* Popover */}
          <Popover>
            <PopoverTrigger render={<Button variant="outline">Popover</Button>} />
            <PopoverContent>
              <PopoverHeader>
                <PopoverTitle>Popover</PopoverTitle>
                <PopoverDescription>Conteúdo ancorado ao gatilho.</PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>

          {/* Tooltip */}
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline">Tooltip</Button>} />
            <TooltipContent>Dica rápida</TooltipContent>
          </Tooltip>

          {/* DropdownMenu */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline"><Settings />Menu</Button>} />
            <DropdownMenuContent>
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuItem><Pencil />Editar</DropdownMenuItem>
              <DropdownMenuItem><Copy />Duplicar</DropdownMenuItem>
              <DropdownMenuItem><ExternalLink />Abrir no Ploomes</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive"><Trash2 />Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Command */}
          <Button variant="outline" onClick={() => setCmdOpen(true)}>Command (⌘K)</Button>
          <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
            <Command>
              <CommandInput placeholder="Buscar comando..." />
              <CommandList>
                <CommandEmpty>Nada encontrado.</CommandEmpty>
                <CommandGroup heading="Sugestões">
                  <CommandItem onSelect={() => setCmdOpen(false)}>Ir para Eventos</CommandItem>
                  <CommandItem onSelect={() => setCmdOpen(false)}>Ir para Vendas</CommandItem>
                  <CommandItem onSelect={() => setCmdOpen(false)}>Ir para BI</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </CommandDialog>
        </Demo>
      </ShowcaseCard>

      {/* Toasts */}
      <ShowcaseCard title="Toast (Sonner)" hint="feedback temporário">
        <Demo>
          <Button variant="outline" onClick={() => toast.success('Salvo com sucesso!')}><Bell />success</Button>
          <Button variant="outline" onClick={() => toast.error('Algo deu errado.')}>error</Button>
          <Button variant="outline" onClick={() => toast.warning('Atenção: revise os dados.')}>warning</Button>
          <Button variant="outline" onClick={() => toast.info('Dica informativa.')}>info</Button>
        </Demo>
      </ShowcaseCard>
    </ShowcaseSection>
  )
}

export function ComponentesShared() {
  const [filters, setFilters] = useState<string[]>(['green'])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(0)

  const toggle = (c: string) =>
    setFilters((f) => (f.includes(c) ? f.filter((x) => x !== c) : [...f, c]))

  return (
    <ShowcaseSection
      id="shared"
      title="Componentes — shared/"
      description="Componentes compostos reutilizados em vários módulos."
    >
      {/* Badges / chips de status */}
      <ShowcaseCard title="StatusBadge · EventStatusBadge · ContractSignedBadge">
        <div className="space-y-4">
          <Demo label="StatusBadge">
            <StatusBadge active /><StatusBadge active={false} />
          </Demo>
          <Demo label="EventStatusBadge (7 status)">
            {EVENT_STATUSES.map((s) => <EventStatusBadge key={s} status={s} />)}
          </Demo>
          <Demo label="ContractSignedBadge">
            <ContractSignedBadge signed /><ContractSignedBadge signed={false} />
          </Demo>
        </div>
      </ShowcaseCard>

      {/* FilterChip + UnitChip */}
      <ShowcaseCard title="FilterChip · UnitChip">
        <div className="space-y-4">
          <Demo label="FilterChip (clique p/ alternar)">
            {(['brand', 'green', 'amber', 'red', 'blue', 'purple', 'orange', 'gray'] as const).map((c) => (
              <FilterChip
                key={c}
                label={c}
                color={c}
                active={filters.includes(c)}
                onClick={() => toggle(c)}
              />
            ))}
          </Demo>
          <Demo label="UnitChip">
            <UnitChip name="Cachola Pinheiros" /><UnitChip name="Cachola Moema" /><UnitChip />
          </Demo>
        </div>
      </ShowcaseCard>

      {/* PageHeader */}
      <ShowcaseCard title="PageHeader">
        <PageHeader
          title="Título da página"
          description="Subtítulo descritivo da seção."
          actions={<Button size="sm"><Plus />Ação</Button>}
        />
      </ShowcaseCard>

      {/* EmptyState */}
      <ShowcaseCard title="EmptyState">
        <EmptyState
          title="Nenhum registro encontrado"
          description="Quando não há dados, mostramos este estado com uma ação opcional."
          action={{ label: 'Criar primeiro', onClick: () => toast.info('Ação do empty state') }}
        />
      </ShowcaseCard>

      {/* Uploads + lightbox */}
      <ShowcaseCard title="PhotoThumb · PhotoDropZone · FileDropZone · PhotoLightbox" hint="upload desativado nesta vitrine">
        <div className="space-y-4">
          <Demo label="PhotoThumb · PhotoLightbox">
            <PhotoThumb src={SAMPLE_IMG('Foto', '7C8D78')} onRemove={() => toast.info('Remover (demo)')} />
            <Button variant="outline" onClick={() => { setLightboxIdx(0); setLightboxOpen(true) }}>Abrir Lightbox</Button>
          </Demo>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="font-mono text-[11px] text-muted-foreground">PhotoDropZone (disabled)</span>
              <PhotoDropZone bucket="demo" folder="demo" disabled onUploadComplete={async () => {}} />
            </div>
            <div className="space-y-1.5">
              <span className="font-mono text-[11px] text-muted-foreground">FileDropZone (disabled)</span>
              <FileDropZone
                bucket="demo"
                folder="demo"
                accept=".pdf,image/*"
                allowedMime={['application/pdf']}
                maxBytes={10 * 1024 * 1024}
                disabled
                onUploaded={async () => {}}
              />
            </div>
          </div>
        </div>
        <PhotoLightbox
          photos={LIGHTBOX_PHOTOS}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          currentIndex={lightboxIdx}
          onIndexChange={setLightboxIdx}
        />
      </ShowcaseCard>

      {/* ConfirmDialog */}
      <ShowcaseCard title="ConfirmDialog">
        <ConfirmDialog
          title="Excluir registro?"
          description="Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          destructive
          onConfirm={() => { toast.success('Confirmado (demo)') }}
          trigger={<Button variant="destructive"><Trash2 />Excluir…</Button>}
        />
      </ShowcaseCard>

      {/* PlaceholderPage */}
      <ShowcaseCard title="PlaceholderPage" hint="usado em rotas 'Em breve'">
        <div className="rounded-md border border-dashed border-border-default">
          <PlaceholderPage
            icon={Star}
            title="Módulo em construção"
            description="Exemplo do placeholder usado em rotas marcadas como 'Em breve'."
          />
        </div>
      </ShowcaseCard>

      <p className="text-xs text-muted-foreground">
        <code className="text-code">SelectUnitModal</code> foi omitido desta vitrine por depender do estado de unidades do usuário (unit-store) e de navegação — fora do escopo de um showcase estático.
      </p>
    </ShowcaseSection>
  )
}
