const REQUESTER_FIELDS = 'name rating ratingCount hostel profileImage';
const HELPER_FIELDS = 'name rating ratingCount';

export function populateRequestDetails(query) {
  return query
    .populate({ path: 'requester', select: REQUESTER_FIELDS })
    .populate({
      path: 'acceptedOffer',
      select: 'helper proposedPrice status',
      populate: { path: 'helper', select: HELPER_FIELDS },
    })
    .populate({ path: 'statusHistory.changedBy', select: HELPER_FIELDS });
}
