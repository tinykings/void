"use client"

import * as React from "react"
import { Moon, Sun, Laptop } from "lucide-react"
import { useTheme } from "next-themes"
import { clsx } from "clsx"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-10 w-full bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
  }

  const modes = [
    { name: 'light', icon: Sun, label: 'Light' },
    { name: 'dark', icon: Moon, label: 'Dark' },
    { name: 'system', icon: Laptop, label: 'System' },
  ]

  return (
    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
      {modes.map((mode) => {
        const Icon = mode.icon
        const isActive = theme === mode.name
        return (
          <button
            key={mode.name}
            onClick={() => setTheme(mode.name)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
              isActive 
                ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            )}
          >
            <Icon size={16} />
            <span>{mode.label}</span>
          </button>
        )
      })}
    </div>
  )
}
