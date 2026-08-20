import React from 'react'
import { ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/alert'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shadcn/card'
import { Progress } from '@/components/shadcn/progress'

export default function GymView({
  status,
  config,
  gymVerifyLoading,
  gymVerifyResult,
  gymVerifyError,
  handleVerifyGymWorkout,
}) {
  const isGymLocked = status.locked && status.window === 'gym'
  const active = status.weeklyActiveCount ?? 0
  const goal = status.gymWeeklyGoal ?? config?.gymWeeklyGoal ?? 5

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Alert variant={isGymLocked ? 'destructive' : 'default'}>
        {isGymLocked ? <ShieldAlert /> : <ShieldCheck />}
        <AlertTitle>{isGymLocked ? 'Gym lock engaged' : 'Activity requirement met'}</AlertTitle>
        <AlertDescription>
          {isGymLocked
            ? status.reason || 'Complete a workout or hit your step target to unlock.'
            : 'No gym breach active right now.'}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Weekly activity</CardTitle>
          <CardDescription>
            {active} of {goal} active days this week.
            {status.isTodayMandatory ? ' Today is mandatory.' : ' Today is optional.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Progress value={goal > 0 ? Math.min(100, (active / goal) * 100) : 0} />
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>
              Yesterday:{' '}
              <strong className="font-medium text-foreground">
                {status.isYesterdayActive ? 'active' : 'rest'}
              </strong>
            </span>
            <span>
              Step target:{' '}
              <strong className="font-medium text-foreground">
                {(config?.gymMinSteps ?? 13000).toLocaleString()}
              </strong>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verify today&apos;s workout</CardTitle>
          <CardDescription>Checks the Hevy API for a workout logged today.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={handleVerifyGymWorkout} disabled={gymVerifyLoading} className="w-fit">
            <RefreshCw className={gymVerifyLoading ? 'size-4 animate-spin' : 'size-4'} />
            {gymVerifyLoading ? 'Checking Hevy…' : 'Verify now'}
          </Button>

          {gymVerifyError && (
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertTitle>Verification failed</AlertTitle>
              <AlertDescription>{gymVerifyError}</AlertDescription>
            </Alert>
          )}

          {gymVerifyResult?.success && (
            <Alert>
              <ShieldCheck />
              <AlertTitle>Workout verified</AlertTitle>
              <AlertDescription>
                {gymVerifyResult.workout?.title || 'Today’s workout was found on Hevy.'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
