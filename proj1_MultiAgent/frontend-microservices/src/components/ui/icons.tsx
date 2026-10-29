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
    ArrowRight, ArrowDown, GitBranch, Workflow, ListOrdered, Sliders,
    Download, Server, Key, Eye, EyeOff, RefreshCw, HardDrive, Gauge, Shield, Code,
    RotateCcw, Wifi, MapPin, Star, Home, Factory, Pencil,
    TrendingUp, ShieldAlert, Mic, Volume2, VolumeX, Radio, Database,
    Bluetooth, Network, LayoutGrid, ChevronRight, History
} from 'lucide-react'

export interface IconProps extends React.SVGProps<SVGSVGElement> {
    className?: string
    size?: number
}

// Re-export Lucide icons with uniform names
export const IconTrendingUp = TrendingUp
export const IconShieldAlert = ShieldAlert
export const IconMic = Mic
export const IconVolume = Volume2
export const IconVolumeMute = VolumeX
export const IconRadio = Radio
export const IconDatabase = Database
export const IconBluetooth = Bluetooth
export const IconNetwork = Network
export const IconLayoutGrid = LayoutGrid
export const IconChevronRight = ChevronRight
export const IconHistory = History
export const IconEdit = Pencil
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
export const IconDownload = Download
export const IconServer = Server
export const IconKey = Key
export const IconEye = Eye
export const IconEyeOff = EyeOff
export const IconRefreshCw = RefreshCw
export const IconHardDrive = HardDrive
export const IconGauge = Gauge
export const IconShield = Shield
export const IconCode = Code
export const IconRotateCcw = RotateCcw
export const IconWifi = Wifi
export const IconMapPin = MapPin
export const IconStar = Star
export const IconHome = Home
export const IconFactory = Factory

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

// Custom Duck (Vịt Rubber Duck AI)
export function IconDuck({ className = 'w-4 h-4', size = 16, ...props }: IconProps) {
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
            <circle cx="15.5" cy="8.5" r="3.5" />
            <path d="M19 8.5h2.5c.5 0 .8.5.5.9l-1.5 2.1c-.3.4-.8.5-1.2.3l-.3-.1" />
            <circle cx="16.5" cy="7.5" r=".7" fill="currentColor" />
            <path d="M14 11.5c-2.5 1-4.5 3-5 5.5-1 0-3-1-4-2.5-.5-.8-.5-1.8 0-2.5 1.2-1.8 3.5-2.8 6-2.5" />
            <path d="M9 17c1.5 2 4 3 7 3 3 0 5-2 5-5 0-1-.3-2-.8-2.8" />
        </svg>
    )
}

// Custom AMR (Autonomous Mobile Robot / AGV)
export function IconAmr({ className = 'w-4 h-4', size = 16, ...props }: IconProps) {
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
            <rect x="3" y="11" width="18" height="6" rx="2" />
            <circle cx="7" cy="19" r="2" />
            <circle cx="17" cy="19" r="2" />
            <path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" />
            <line x1="12" y1="5" x2="12" y2="2" />
            <circle cx="12" cy="2" r="1" fill="currentColor" />
        </svg>
    )
}

// Custom Cyber Drone
export function IconDrone({ className = 'w-4 h-4', size = 16, ...props }: IconProps) {
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
            <circle cx="12" cy="12" r="3" />
            <path d="m5 5 4 4" />
            <path d="m19 5-4 4" />
            <path d="m5 19 4-4" />
            <path d="m19 19-4-4" />
            <circle cx="4" cy="4" r="2" />
            <circle cx="20" cy="4" r="2" />
            <circle cx="4" cy="20" r="2" />
            <circle cx="20" cy="20" r="2" />
        </svg>
    )
}

// Custom Humanoid Robot
export function IconHumanoid({ className = 'w-4 h-4', size = 16, ...props }: IconProps) {
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
            <circle cx="12" cy="5" r="2" />
            <path d="m9 20 3-6 3 6" />
            <path d="m6 8 6 2 6-2" />
            <path d="M12 10v4" />
        </svg>
    )
}
