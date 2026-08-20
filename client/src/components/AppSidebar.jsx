import React from 'react'
import { PanelLeftClose, PanelLeftOpen, Shield, ShieldAlert, Zap } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/shadcn/sidebar'
import { NAV_SECTIONS } from '@/nav'
import { cn } from '@/lib/utils'

export default function AppSidebar({ activeTab, setActiveTab, status, ipInfo, triggerTestLock, ...props }) {
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar()
  const collapsed = state === 'collapsed'

  const go = (id) => {
    setActiveTab(id)
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => go('dashboard')}>
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                {status.locked ? <ShieldAlert className="size-4" /> : <Shield className="size-4" />}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Habit Armour</span>
                <span className="truncate text-xs">{status.locked ? 'Lock engaged' : 'Protected'}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map(({ id, label, icon: Icon }) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      isActive={activeTab === id}
                      tooltip={label}
                      onClick={() => go(id)}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Test screen lock" onClick={triggerTestLock}>
              <Zap />
              <span>Test screen lock</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {!isMobile && (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={toggleSidebar}
              >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                <span>Collapse</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>

        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
        <div className="group-data-[collapsible=icon]:hidden">
          {status.window && (
            <p className="text-sidebar-foreground/70 px-2 text-xs">
              Active window: <span className="text-sidebar-foreground font-medium">{status.window}</span>
            </p>
          )}
          {ipInfo && (
            <p className={cn('text-sidebar-foreground/70 truncate px-2 font-mono text-[11px]', status.window && 'mt-1')}>
              http://{ipInfo}:3000/api/status
            </p>
          )}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
