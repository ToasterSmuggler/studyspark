export declare type PaginatedPayload<T> = {
    hasMore: boolean;
    endCursor: string | null;
    totalCount: number;
    data: T[];
};
export declare type IterablePaginatedPayload<T> = Promise<PaginatedPayload<T>> & AsyncIterableIterator<T>;
export declare type SinglePayload<T> = {
    data: T;
};
export declare namespace Payload {
    interface PaginatedResponse<T> {
        hasNext: boolean;
        endCursor: string | null;
        totalCount: number;
        data: T[];
    }
    interface Transforms {
        Member: {
            id: string;
            auth: {
                email: string;
            };
            verified: boolean;
            metaData: object;
            json: object;
            loginRedirect: string;
            customFields: object;
            permissions: string[] | [];
            planConnections: Transforms["MemberPlanConnection"][];
        };
        MemberPlanConnection: string | {
            id: string;
            active: boolean;
            status: string;
            planId: string;
            type: string;
            payment: {
                amount: number;
                currency: string;
                status: string;
                lastBillingDate: number | null;
                nextBillingDate: number | null;
                cancelAtDate: number | null;
                lastInvoice: string | null;
                lastReceipt: string | null;
                card: string;
            } | null;
        };
    }
}
