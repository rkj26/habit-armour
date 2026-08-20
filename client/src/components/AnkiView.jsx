import React, { useCallback, useEffect, useState } from 'react'
import {
  Check,
  CircleAlert,
  Info,
  RefreshCw,
  Smartphone,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'

import { api } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/alert'
import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
import { Input } from '@/components/shadcn/input'
import { Label } from '@/components/shadcn/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { cn } from '@/lib/utils'

function StatCard({ label, value, hint, children }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        {value !== undefined && (
          <CardTitle className="text-3xl font-semibold tabular-nums">{value}</CardTitle>
        )}
      </CardHeader>
      <CardContent className="px-4">
        {children}
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export default function AnkiView({ onRefreshStatus }) {
  const [ankiData, setAnkiData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState(null)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideReason, setOverrideReason] = useState('Reviewed on Anki Mobile / AnkiWeb')
  const [submittingOverride, setSubmittingOverride] = useState(false)
  const [overrideSuccess, setOverrideSuccess] = useState(null)

  const fetchAnkiStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAnkiData(await api.anki.status())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnkiStatus()
  }, [fetchAnkiStatus])

  const handleForceVerify = async () => {
    setVerifying(true)
    setError(null)
    try {
      const data = await api.anki.verify()
      setAnkiData((prev) => ({
        ...prev,
        reachable: data.reachable,
        verified: data.verified,
        reason: data.reason,
        decks: data.decks,
        totalDue: data.totalDue,
        reviewedToday: data.reviewedToday,
      }))
      onRefreshStatus?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setVerifying(false)
    }
  }

  const handleSubmitOverride = async (e) => {
    e.preventDefault()
    setSubmittingOverride(true)
    setError(null)
    try {
      await api.anki.override(overrideReason)
      setOverrideOpen(false)
      setOverrideSuccess('Anki requirement marked complete via manual override.')
      fetchAnkiStatus()
      onRefreshStatus?.()
      setTimeout(() => setOverrideSuccess(null), 5000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmittingOverride(false)
    }
  }

  const handleResetOverride = async () => {
    try {
      await api.anki.resetOverride()
      fetchAnkiStatus()
      onRefreshStatus?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const totalDue = ankiData?.totalDue ?? 0
  const reviewedToday = ankiData?.reviewedToday ?? 0
  const isReachable = ankiData?.reachable ?? false
  const isVerified = ankiData?.verified ?? false
  const isManualOverride = ankiData?.manualOverride ?? false
  const decks = ankiData?.decks || []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-end gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleForceVerify} disabled={verifying || loading}>
            <RefreshCw className={cn('size-4', verifying && 'animate-spin')} />
            {verifying ? 'Verifying…' : 'Refresh queue'}
          </Button>
          <Button onClick={() => setOverrideOpen(true)}>
            <Smartphone className="size-4" />
            Studied on mobile
          </Button>
        </div>
      </div>

      {overrideSuccess && (
        <Alert>
          <Check />
          <AlertTitle>{overrideSuccess}</AlertTitle>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Anki request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Daily status">
          <Badge variant={isVerified ? 'default' : 'secondary'} className="gap-1.5">
            {isVerified ? (
              isManualOverride ? (
                <Sparkles className="size-3" />
              ) : (
                <Check className="size-3" />
              )
            ) : (
              <CircleAlert className="size-3" />
            )}
            {isVerified ? (isManualOverride ? 'Overridden' : 'All decks cleared') : 'Reviews pending'}
          </Badge>
          {isManualOverride && (
            <p className="text-muted-foreground mt-2 text-xs">
              {ankiData?.overrideReason || 'Manual override'}
              <button
                type="button"
                onClick={handleResetOverride}
                className="text-destructive ml-2 underline underline-offset-2"
              >
                Reset
              </button>
            </p>
          )}
        </StatCard>

        <StatCard
          label="Due cards"
          value={isReachable ? totalDue : '—'}
          hint={totalDue === 0 ? 'Queue is clear.' : `${totalDue} still to review.`}
        />

        <StatCard
          label="Reviewed today"
          value={isReachable ? reviewedToday : '—'}
          hint="Cards studied in Anki today."
        />

        <StatCard label="Anki desktop">
          <Badge variant={isReachable ? 'outline' : 'destructive'} className="gap-1.5">
            <span
              className={cn('size-1.5 rounded-full', isReachable ? 'bg-emerald-600' : 'bg-current')}
            />
            {isReachable ? 'Connected' : 'Offline'}
          </Badge>
          <p className="text-muted-foreground mt-2 text-xs">
            {isReachable ? 'Live via AnkiConnect.' : 'Launch Anki to sync live stats.'}
          </p>
        </StatCard>
      </div>

      {!isReachable && (
        <Alert>
          <Info />
          <AlertTitle>Anki desktop is not running</AlertTitle>
          <AlertDescription>
            <p>Habit Armour reads your decks through the AnkiConnect add-on.</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Open Anki on this Mac.</li>
              <li>
                Install AnkiConnect if needed — Tools › Add-ons › Get Add-ons › code{' '}
                <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">2055492159</code>.
              </li>
              <li>Hit “Refresh queue” above.</li>
              <li>Studied on your phone instead? Use “Studied on mobile”.</li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active decks</CardTitle>
          <CardDescription>Each must reach zero due cards to clear the lock.</CardDescription>
          <CardAction>
            <Badge variant="outline">
              {decks.length} {decks.length === 1 ? 'deck' : 'decks'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {decks.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {loading ? 'Fetching decks from Anki…' : 'No active decks detected.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deck</TableHead>
                  <TableHead className="text-center">Review</TableHead>
                  <TableHead className="text-center">Learning</TableHead>
                  <TableHead className="text-center">New</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decks.map((deck) => {
                  const dueCount = deck.due_count ?? deck.due ?? 0
                  const reviewCount = deck.review_count ?? deck.review ?? 0
                  const learnCount = deck.learn_count ?? deck.learn ?? 0
                  const newCount = deck.new_count ?? deck.new ?? 0
                  const totalCount = deck.total_in_deck ?? deck.total ?? 0
                  const isCleared = Boolean(deck.cleared) || dueCount === 0
                  return (
                    <TableRow key={deck.deck_id || deck.name}>
                      <TableCell className="font-medium">{deck.name}</TableCell>
                      <TableCell
                        className={cn(
                          'text-center tabular-nums',
                          reviewCount > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'
                        )}
                      >
                        {reviewCount}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-center tabular-nums',
                          learnCount > 0 ? 'font-semibold text-amber-600' : 'text-muted-foreground'
                        )}
                      >
                        {learnCount}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{newCount}</TableCell>
                      <TableCell className="text-muted-foreground text-center tabular-nums">
                        {totalCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={isCleared ? 'outline' : 'destructive'}>
                          {isCleared ? 'Cleared' : `${dueCount} due`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <form onSubmit={handleSubmitOverride}>
            <DialogHeader>
              <DialogTitle>Manual review override</DialogTitle>
              <DialogDescription>
                For reviews finished on AnkiMobile or AnkiWeb that never synced to the desktop app.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <Label htmlFor="override-reason">Reason</Label>
              <Input
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Cleared every deck on AnkiMobile"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOverrideOpen(false)}
                disabled={submittingOverride}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submittingOverride}>
                {submittingOverride ? 'Saving…' : 'Clear requirement'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
