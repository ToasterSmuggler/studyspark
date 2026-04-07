export declare namespace Params {
    type ListMembers = {
        limit?: number;
        after?: string | number;
        order?: "ASC" | "DESC";
    };
    type AddFreePlan = {
        id: string;
        data: {
            planId: string;
        };
    };
    type RemoveFreePlan = {
        id: string;
        data: {
            planId: string;
        };
    };
    type RetrieveMember = {
        id: string;
        email?: never;
    } | {
        email: string;
        id?: never;
    };
    type CreateMember = {
        email: string;
        password: string;
        customFields?: object;
        metaData?: object;
        json?: object;
        loginRedirect?: string;
        plans?: {
            planId: string;
        }[];
    };
    type UpdateMember = {
        id: string;
        data: {
            email?: string;
            metaData?: object;
            customFields?: object;
            json?: object;
            verified?: boolean;
        };
    };
    type DeleteMember = {
        id: string;
        data?: {
            deleteStripeCustomer?: boolean;
            cancelStripeSubscriptions?: boolean;
        };
    };
}
