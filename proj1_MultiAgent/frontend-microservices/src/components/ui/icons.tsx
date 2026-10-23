import React from 'react'
import {
    Paperclip, LogOut, Globe, Lock, Share2, Check,
    Settings, ChevronDown, ChevronUp, Lightbulb, UserPlus,
    Clock, Coins, ShoppingBag,
    Brain, FileText, Wrench, MessageSquare, Save, Trash2,
    ArrowLeft, AlertCircle, CheckCircle2, Activity, Ban,
    Sparkles, Cpu, Plus, X, Bot, Building2, Trees, Laptop,
    Armchair, Coffee, Compass, Search, BarChart2, Send,
    Layers, Boxes, Terminal, Tent, Droplets, Gamepad2,
    Copy, Zap, Users, User, Palette, Map, Cloud, Rocket,
    Link, Target, Play, Circle, ExternalLink, HelpCircle,
    ArrowRight, ArrowDown, GitBranch, Workflow, ListOrdered, Sliders
} from 'lucide-react'

export interface IconProps extends React.SVGProps<SVGSVGElement> {
    className?: string
    size?: number
}

// Re-export Lucide icons with uniform names
export const IconPaperclip = Paperclip
export const IconLogOut = LogOut
export const IconGlobe = Globe
export const IconLock = Lock
export const IconShare2 = Share2
export const IconCheck = Check
export const IconSettings = Settings
export const IconChevronDown = ChevronDown
export const IconChevronUp = ChevronUp
export const IconLightbulb = Lightbulb
export const IconUserPlus = UserPlus
export const IconClock = Clock
export const IconCoins = Coins
export const IconShoppingBag = ShoppingBag
export const IconBrain = Brain
export const IconFileText = FileText
export const IconWrench = Wrench
export const IconMessageSquare = MessageSquare
export const IconSave = Save
export const IconTrash = Trash2
export const IconArrowLeft = ArrowLeft
export const IconAlertCircle = AlertCircle
export const IconCheckCircle = CheckCircle2
export const IconActivity = Activity
export const IconBan = Ban
export const IconSparkles = Sparkles
export const IconCpu = Cpu
export const IconPlus = Plus
export const IconX = X
export const IconBot = Bot
export const IconBuilding = Building2
export const IconTrees = Trees
export const IconLaptop = Laptop
export const IconArmchair = Armchair
export const IconCoffee = Coffee
export const IconCompass = Compass
export const IconSearch = Search
export const IconBarChart = BarChart2
export const IconSend = Send
export const IconLayers = Layers
export const IconBoxes = Boxes
export const IconTerminal = Terminal
export const IconTent = Tent
export const IconDroplets = Droplets
export const IconGameController = Gamepad2
export const IconCopy = Copy
export const IconZap = Zap
export const IconUsers = Users
export const IconUser = User
export const IconPalette = Palette
export const IconMap = Map
export const IconCloud = Cloud
export const IconRocket = Rocket
export const IconLink = Link
export const IconTarget = Target
export const IconPlay = Play
export const IconCircle = Circle
export const IconExternalLink = ExternalLink
export const IconHelpCircle = HelpCircle
export const IconArrowRight = ArrowRight
export const IconArrowDown = ArrowDown
export const IconGitBranch = GitBranch
export const IconWorkflow = Workflow
export const IconListOrdered = ListOrdered
export const IconSliders = Sliders

// Custom Trace icon
export function IconTrace({ className = 'w-4 h-4', size = 16, ...props }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            {...props}
        >
            <circle cx="5" cy="6" r="3" />
            <path d="M5 9v6" />
            <circle cx="5" cy="18" r="3" />
            <path d="M8 6h5a4 4 0 0 1 4 4v4" />
            <circle cx="17" cy="18" r="3" />
        </svg>
    )
}
