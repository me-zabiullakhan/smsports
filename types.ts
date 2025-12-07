
export enum PlayerCategory {
  Batsman = "Batsman",
  Bowler = "Bowler",
  AllRounder = "All-Rounder",
  Wicketkeeper = "Wicketkeeper",
}

export interface Player {
  id: number | string;
  name: string;
  photoUrl: string;
  category: PlayerCategory | string;
  basePrice: number;
  nationality: string;
  speciality: string;
  stats: {
    matches: number;
    runs: number;
    wickets: number;
  };
  status?: 'SOLD' | 'UNSOLD';
  soldPrice?: number;
  soldTo?: string;
}

export interface RegisteredPlayer {
    id: string;
    fullName: string;
    mobile: string;
    playerType: string;
    gender: string;
    dob: string;
    profilePic: string;
    paymentScreenshot: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    submittedAt: number;
    [key: string]: any; // For custom fields
}

export interface Team {
  id: number | string;
  name: string;
  shortName?: string;
  owner: string;
  logoUrl: string;
  budget: number;
  players: Player[];
  minPlayers?: number;
  maxPlayers?: number;
  password?: string; // Added password for team login
}

export interface Bid {
  teamId: number | string;
  amount: number;
}

export enum AuctionStatus {
  NotStarted = "NOT_STARTED",
  InProgress = "IN_PROGRESS",
  Paused = "PAUSED",
  Sold = "SOLD",
  Unsold = "UNSOLD",
  Finished = "FINISHED",
}

export interface AuctionLog {
  message: string;
  timestamp: number;
  type: 'SYSTEM' | 'BID' | 'SOLD' | 'UNSOLD';
}

export interface BidIncrementSlab {
    from: number;
    increment: number;
}

export interface AuctionCategory {
    id?: string;
    name: string;
    basePrice: number;
    minPerTeam: number;
    maxPerTeam: number;
    bidIncrement: number;
    bidLimit: number;
    slabs: BidIncrementSlab[];
}

export interface AuctionState {
  players: Player[];
  teams: Team[];
  unsoldPlayers: Player[]; // This is the pool of available players
  categories: AuctionCategory[]; // Available categories with rules
  status: AuctionStatus;
  currentPlayerId: string | number | null; // Source of truth for current player
  currentPlayerIndex: number | null; // Derived helper
  currentBid: number | null;
  highestBidder: Team | null;
  timer: number;
  bidIncrement: number; // Global fallback increment
  auctionLog: AuctionLog[];
  biddingEnabled: boolean; // Global toggle for team bidding
  playerSelectionMode: 'MANUAL' | 'AUTO';
}

export enum UserRole {
  ADMIN = 'ADMIN',
  TEAM_OWNER = 'TEAM_OWNER',
  VIEWER = 'VIEWER'
}

export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  role: UserRole;
  teamId?: number | string; // If role is TEAM_OWNER
}

export type FieldType = 'text' | 'number' | 'email' | 'select' | 'date' | 'file' | 'textarea';

export interface FormField {
    id: string;
    label: string;
    type: FieldType;
    required: boolean;
    options?: string[]; // For select inputs
    placeholder?: string;
}

export interface RegistrationConfig {
    isEnabled: boolean;
    fee: number;
    upiId: string;
    upiName: string;
    qrCodeUrl: string;
    terms: string;
    bannerUrl?: string; // Optional tournament logo
    customFields: FormField[];
}

export interface AuctionSetup {
    id?: string;
    title: string;
    sport: string;
    date: string;
    plan: string;
    totalTeams: number;
    purseValue: number;
    basePrice: number;
    bidIncrement: number;
    playersPerTeam: number;
    status: 'DRAFT' | 'LIVE' | 'COMPLETED';
    createdAt: number;
    createdBy?: string;
    registrationConfig?: RegistrationConfig;
    logoUrl?: string;
    bannerUrl?: string;
    playerSelectionMode?: 'MANUAL' | 'AUTO';
}

export interface AuctionContextType {
    state: AuctionState;
    userProfile: UserProfile | null;
    setUserProfile: (profile: UserProfile) => void;
    placeBid: (teamId: number | string, amount: number) => Promise<void>;
    sellPlayer: (teamId?: string | number, customPrice?: number) => Promise<void>;
    passPlayer: () => Promise<void>;
    startAuction: (specificPlayerId?: string | number) => Promise<boolean>;
    endAuction: () => Promise<void>;
    resetAuction: () => Promise<void>;
    resetCurrentPlayer: () => Promise<void>;
    toggleBidding: () => Promise<void>; // New toggle function
    toggleSelectionMode: () => Promise<void>; // Toggle Auto/Manual
    logout: () => void;
    error: string | null;
    joinAuction: (id: string) => void;
    activeAuctionId: string | null;
    nextBid: number; 
}
