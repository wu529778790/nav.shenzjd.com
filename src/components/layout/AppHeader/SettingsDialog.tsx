/**
 * 设置对话框
 *
 * 全站私有模式（2026-08-21 起）：数据存储于 Turso 数据库，无登录/账户概念。
 * 同步由 SyncManager 后台自动驱动。
 */

"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Database } from "lucide-react";

interface SettingsDialogProps {
  /** 是否显示 */
  open: boolean;
  /** 显示/隐藏切换 */
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>数据存储与同步信息</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 存储信息 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--foreground-secondary)]">数据存储</h3>
            <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/45 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-600)]/10 text-[var(--primary-700)]">
                <Database className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">Turso 数据库</div>
                <div className="text-xs text-[var(--muted-foreground)]">数据实时读写，毫秒级同步</div>
              </div>
            </div>
          </div>

          {/* 同步说明 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--foreground-secondary)]">同步状态</h3>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/45 p-3 text-sm text-[var(--muted-foreground)]">
              <p>同步完全自动进行，修改后 3 秒内自动写入数据库，多设备实时一致。无需手动操作。</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
