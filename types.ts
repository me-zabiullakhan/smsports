
export enum PlayerCategory {
  Batsman = "Batsman",
  Bowler = "Bowler",
  AllRounder = "All-Rounder",
  Wicketkeeper = "Wicketkeeper",
}

export interface PlayerRole {
    id?: string;
    name: string;
    basePrice: number; // Default base price for this role
}

export interface Player {
  id: number | string;
  name: string;
  photoUrl: string;
  category: string; // Auction Category (Group: MVP, Set 1, Uncapped)
  role: string;     // Player Type (Skill: Batsman, Bowler)
  basePrice: number;
  nationality: string;
  speciality: string; // Kept for backward compat, usually same as role
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

export interface Sponsor {
    id: string;
    name: string;
    imageUrl: string;
}

export interface SponsorConfig {
    showOnOBS: boolean;
    showOnProjector: boolean;
    loopInterval: number; // seconds
}

export type ProjectorLayout = 'STANDARD' | 'IPL' | 'MODERN';
export type OBSLayout = 'STANDARD' | 'MINIMAL' | 'VERTICAL';

export type AdminViewType = 'SQUAD' | 'PURSES' | 'UNSOLD' | 'SOLD' | 'TOP_BUY' | 'TOP_5' | 'NONE';

export interface AdminViewOverride {
    type: AdminViewType;
    data?: any; // e.g. { teamId: '...' }
}

export type BiddingStatus = 'ON' | 'PAUSED' | 'HIDDEN';

export interface AuctionState {
  players: Player[];
  teams: Team[];
  unsoldPlayers: Player[]; // This is the pool of available players
  categories: AuctionCategory[]; // Available categories with rules
  roles: PlayerRole[]; // Added Roles to State
  status: AuctionStatus;
  currentPlayerId: string | number | null; // Source of truth for current player
  currentPlayerIndex: number | null; // Derived helper
  currentBid: number | null;
  highestBidder: Team | null;
  timer: number;
  bidIncrement: number; // Global fallback increment
  bidSlabs?: BidIncrementSlab[]; // Global fallback slabs
  auctionLog: AuctionLog[];
  biddingStatus: BiddingStatus; // Replaces biddingEnabled
  playerSelectionMode: 'MANUAL' | 'AUTO';
  auctionLogoUrl?: string;
  tournamentName?: string;
  sponsors: Sponsor[];
  sponsorConfig: SponsorConfig;
  projectorLayout: ProjectorLayout;
  obsLayout: OBSLayout;
  adminViewOverride: AdminViewOverride | null;
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
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
    slabs?: BidIncrementSlab[]; // Global slabs for auction
    playersPerTeam: number;
    status: 'DRAFT' | 'LIVE' | 'COMPLETED';
    createdAt: number;
    createdBy?: string;
    registrationConfig?: RegistrationConfig;
    logoUrl?: string;
    bannerUrl?: string;
    playerSelectionMode?: 'MANUAL' | 'AUTO';
    sponsors?: Sponsor[];
    sponsorConfig?: SponsorConfig;
    projectorLayout?: ProjectorLayout;
    obsLayout?: OBSLayout;
}

export interface AuctionContextType {
    state: AuctionState;
    userProfile: UserProfile | null;
    setUserProfile: (profile: UserProfile) => void;
    placeBid: (teamId: number | string, amount: number) => Promise<void>;
    sellPlayer: (teamId?: string | number, customPrice?: number) => Promise<void>;
    passPlayer: () => Promise<void>;
    correctPlayerSale: (playerId: string, newTeamId: string | null, newPrice: number) => Promise<void>;
    startAuction: (specificPlayerId?: string | number) => Promise<boolean>;
    endAuction: () => Promise<void>;
    resetAuction: () => Promise<void>;
    resetCurrentPlayer: () => Promise<void>;
    resetUnsoldPlayers: () => Promise<void>;
    updateBiddingStatus: (status: BiddingStatus) => Promise<void>; // Updated from toggleBidding
    toggleSelectionMode: () => Promise<void>; // Toggle Auto/Manual
    updateTheme: (type: 'PROJECTOR' | 'OBS', layout: string) => Promise<void>;
    setAdminView: (view: AdminViewOverride | null) => Promise<void>;
    logout: () => void;
    error: string | null;
    joinAuction: (id: string) => void;
    activeAuctionId: string | null;
    nextBid: number; 
}

// --- SCORING TYPES ---

export interface BatsmanStats {
    playerId: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    isStriker: boolean;
    outBy?: string; // If out, how/who
}

export interface BowlerStats {
    playerId: string;
    name: string;
    overs: number; // 1.2
    ballsBowled: number; // actual valid balls in current over
    runsConceded: number;
    wickets: number;
    maidens: number;
}

export interface BallEvent {
    ballNumber: number;
    overNumber: number; // 0, 1, 2...
    bowlerId: string;
    batsmanId: string;
    runs: number;
    isWide: boolean;
    isNoBall: boolean;
    isWicket: boolean;
    wicketType?: string;
    extras: number;
    commentary?: string;
}

export interface InningsState {
    battingTeamId: string;
    bowlingTeamId: string;
    totalRuns: number;
    wickets: number;
    overs: number; // e.g., 10.4
    ballsInCurrentOver: number; // 0-6 (valid balls)
    currentRunRate: number;
    extras: {
        wides: number;
        noBalls: number;
        byes: number;
        legByes: number;
    };
    strikerId: string | null;
    nonStrikerId: string | null;
    currentBowlerId: string | null;
    batsmen: { [playerId: string]: BatsmanStats };
    bowlers: { [playerId: string]: BowlerStats };
    recentBalls: BallEvent[];
}

export interface Match {
    id: string;
    auctionId: string; // To link back to auction players
    teamAId: string;
    teamBId: string;
    teamAName: string;
    teamBName: string;
    totalOvers: number;
    status: 'SCHEDULED' | 'TOSS' | 'LIVE' | 'COMPLETED';
    tossWinnerId?: string;
    tossChoice?: 'BAT' | 'BOWL';
    currentInnings: 1 | 2;
    innings: {
        1: InningsState;
        2: InningsState;
    };
    winnerId?: string;
    createdAt: number;
}
