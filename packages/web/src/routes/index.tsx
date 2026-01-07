import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/layout/AppLayout'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return <AppLayout />
}
