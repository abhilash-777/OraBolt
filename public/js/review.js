document.addEventListener('DOMContentLoaded', function() {
    // Handle Bootstrap tab clicks
    const tabLinks = document.querySelectorAll('a[data-toggle="pill"]');
    tabLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active from all
            document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('show', 'active');
            });
            
            // Add active to clicked
            this.classList.add('active');
            const targetId = this.getAttribute('href');
            const targetPane = document.querySelector(targetId);
            if (targetPane) {
                targetPane.classList.add('show', 'active');
            }
            
            // Update URL hash
            window.location.hash = targetId;
        });
    });
    
    // Check URL hash on load and activate corresponding tab
    if (window.location.hash) {
        const hashTab = document.querySelector('a[href="' + window.location.hash + '"]');
        if (hashTab) {
            hashTab.click();
        }
    }

    // Find all "Write a Review" buttons and add click handlers
    const writeReviewButtons = document.querySelectorAll('[data-toggle="modal"][data-target="#reviewModal"]');
    
    writeReviewButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const modalElement = document.getElementById('reviewModal');
            
            if (!modalElement) {
                console.error('Review modal not found!');
                return;
            }
            
            // Try jQuery first (Bootstrap 4)
            if (typeof $ !== 'undefined' && $.fn.modal) {
                $('#reviewModal').modal('show');
            } 
            // Try Bootstrap 5
            else if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modal = new bootstrap.Modal(modalElement);
                modal.show();
            }
            // Manual fallback
            else {
                console.log('Opening modal manually...');
                modalElement.style.display = 'block';
                modalElement.classList.add('show');
                modalElement.setAttribute('aria-modal', 'true');
                modalElement.removeAttribute('aria-hidden');
                document.body.classList.add('modal-open');
                
                // Create backdrop
                const backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop fade show';
                backdrop.id = 'reviewModalBackdrop';
                document.body.appendChild(backdrop);
                
                // Close modal on backdrop click
                backdrop.addEventListener('click', function() {
                    closeModal();
                });
                
                // Close modal on X button
                const closeButtons = modalElement.querySelectorAll('[data-dismiss="modal"]');
                closeButtons.forEach(btn => {
                    btn.addEventListener('click', function() {
                        closeModal();
                    });
                });
            }
        });
    });
    
    // Manual close modal function
    function closeModal() {
        const modalElement = document.getElementById('reviewModal');
        const backdrop = document.getElementById('reviewModalBackdrop');
        
        if (modalElement) {
            modalElement.style.display = 'none';
            modalElement.classList.remove('show');
            modalElement.setAttribute('aria-hidden', 'true');
            modalElement.removeAttribute('aria-modal');
        }
        
        if (backdrop) {
            backdrop.remove();
        }
        
        document.body.classList.remove('modal-open');
        
        // Reset form
        const reviewForm = document.getElementById('reviewForm');
        if (reviewForm) {
            reviewForm.reset();
            const ratingInput = document.getElementById('rating');
            if (ratingInput) ratingInput.value = '0';
            updateStarDisplay(0);
            const commentCount = document.getElementById('commentCount');
            if (commentCount) commentCount.textContent = '0';
        }
    }

    // ==================== REVIEW SYSTEM ====================
    const productId = document.getElementById("productId").value;
    let currentPage = 1;
    let currentFilter = '';
    let currentSort = 'recent';

    // Star rating input
    const starInputs = document.querySelectorAll('.star-input');
    const ratingInput = document.getElementById('rating');

    if (starInputs.length > 0) {
        starInputs.forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.dataset.rating);
                ratingInput.value = rating;
                updateStarDisplay(rating);
            });

            star.addEventListener('mouseenter', function() {
                const rating = parseInt(this.dataset.rating);
                updateStarDisplay(rating);
            });
        });

        document.querySelector('.stars-interactive')?.addEventListener('mouseleave', function() {
            updateStarDisplay(parseInt(ratingInput.value) || 0);
        });
    }

    function updateStarDisplay(rating) {
        starInputs.forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            if (starRating <= rating) {
                star.classList.remove('ion-ios-star-outline');
                star.classList.add('ion-ios-star', 'active');
            } else {
                star.classList.remove('ion-ios-star', 'active');
                star.classList.add('ion-ios-star-outline');
            }
        });
    }

    // Character counter
    const reviewComment = document.getElementById('reviewComment');
    const commentCount = document.getElementById('commentCount');

    if (reviewComment && commentCount) {
        reviewComment.addEventListener('input', function() {
            commentCount.textContent = this.value.length;
        });
    }

    // Submit review
    const reviewForm = document.getElementById('reviewForm');
    const submitBtn = document.getElementById('submitReviewBtn');
    if (reviewForm) {
        reviewForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const rating = ratingInput.value;
            const title = document.getElementById('reviewTitle').value;
            const comment = reviewComment.value;
            const isEditing = document.getElementById('isEditing').value === 'true';
            const reviewId = document.getElementById('reviewId').value;
            const productId = document.getElementById('productId').value;

            

            // Validate rating
            if (!rating || rating === '0') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Rating Required',
                    text: 'Please select a star rating'
                });
                return;
            }

            // Validate title
            if (!title.trim()) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Title Required',
                    text: 'Please enter a review title'
                });
                return;
            }

            // Validate comment
            if (!comment.trim()) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Review Required',
                    text: 'Please enter your review'
                });
                return;
            }

            // Disable button
            submitBtn.disabled = true;
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm mr-2"></span>Processing...';

            try {
                if (isEditing) {
                
                    const reviewData = {
                        rating: parseInt(rating),
                        title: title.trim(),
                        comment: comment.trim()
                    };

                    const response = await fetch(`/review/update/${reviewId}`, {
                        method: 'PUT',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(reviewData)
                    });
                
                    const result = await response.json();

                    if (result.success) {
                        // Close modal
                        if (typeof $ !== 'undefined' && $.fn.modal) {
                            $('#reviewModal').modal('hide');
                        } else {
                            closeModal();
                        }
                   
                        Swal.fire({
                            icon: 'success',
                            title: 'Review Updated!',
                            text: 'Your review has been updated successfully',
                            showConfirmButton: false,
                            timer: 1500
                        }).then(() => {
                            window.location.reload();
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: result.message || 'Failed to update review'
                        });
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalText;
                    }                
                } else {
                    // Get user's delivered orders
                    const ordersRes = await fetch('/review/my-orders');
                
                    if (!ordersRes.ok) {
                        throw new Error(`Failed to fetch orders: ${ordersRes.status}`);
                    }
                
                    const ordersData = await ordersRes.json();
                
                    if (!ordersData.success) {
                        throw new Error(ordersData.message || 'Failed to fetch orders');
                    }
                
                    const orderItem = ordersData.reviewableProducts?.find(
                        item => item.product._id === productId
                    );

                    if (!orderItem) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Cannot Review',
                            text: 'You must purchase and receive this product to review it'
                        });
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalText;
                        return;
                    }

                    const reviewData = {
                        productId: productId,
                        orderId: orderItem.orderId,
                        rating: parseInt(rating),
                        title: title.trim(),
                        comment: comment.trim()
                    };

                    const response = await fetch('/review/submit', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(reviewData)
                    });

                    const result = await response.json();

                    if (result.success) {
                        // Close modal
                        if (typeof $ !== 'undefined' && $.fn.modal) {
                            $('#reviewModal').modal('hide');
                        } else {
                            closeModal();
                        }
                    
                        Swal.fire({
                            icon: 'success',
                            title: 'Review Submitted!',
                            text: 'Thank you for your review',
                            showConfirmButton: false,
                            timer: 1500
                        }).then(() => {
                            window.location.reload();
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: result.message || 'Failed to submit review'
                        });
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalText;
                    }
                }
            
            } catch (error) {
                console.error('Error processing review:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message || 'Something went wrong. Please try again.'
                });
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    // Mark review as helpful
    document.querySelectorAll('.helpful-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const reviewId = this.dataset.reviewId;
            try {
                const response = await fetch(`/review/helpful/${reviewId}`, {
                    method: 'POST'
                });
                const result = await response.json();
                if (result.success) {
                    const countSpan = this.querySelector('.helpful-count');
                    countSpan.textContent = result.helpfulCount;
                    if (result.helpful) {
                        this.classList.add('marked');
                    } else {
                        this.classList.remove('marked');
                    }
                }
            } catch (error) {
                console.error('Error marking review helpful:', error);
            }
        });
    });

    // Filter and sort reviews
    const ratingFilter = document.getElementById('ratingFilter');
    if (ratingFilter) {
        ratingFilter.addEventListener('change', function() {
            currentFilter = this.value;
            currentPage = 1;
            loadReviews();
        });
    }

    const sortReviews = document.getElementById('sortReviews');
    if (sortReviews) {
        sortReviews.addEventListener('change', function() {
            currentSort = this.value;
            currentPage = 1;
            loadReviews();
        });
    }

    // Load reviews function
    async function loadReviews(append = false) {
        if (!productId) return;
        
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: 10,
                sortBy: currentSort
            });

            if (currentFilter) {
                params.append('rating', currentFilter);
            }

            const response = await fetch(`/review/product/${productId}?${params}`);
            const data = await response.json();

            if (data.success) {
                const reviewsList = document.getElementById('reviewsList');
                const reviewsHTML = data.reviews.map(review => createReviewHTML(review)).join('');

                if (append) {
                    reviewsList.insertAdjacentHTML('beforeend', reviewsHTML);
                } else {
                    reviewsList.innerHTML = reviewsHTML;
                }

                const loadMoreContainer = document.getElementById('loadMoreContainer');
                if (loadMoreContainer) {
                    loadMoreContainer.style.display = data.pagination.hasNext ? 'block' : 'none';
                }

                attachHelpfulListeners();
            }
        } catch (error) {
            console.error('Error loading reviews:', error);
        }
    }

    function createReviewHTML(review) {
        const stars = Array(5).fill(0).map((_, i) => {
            const starClass = i < review.rating ? 'ion-ios-star' : 'ion-ios-star-outline';
            return `<i class="${starClass}" style="color: #f4c430;"></i>`;
        }).join('');

        const date = new Date(review.createdAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        return `
            <div class="review mb-4 pb-4 border-bottom">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h5 class="mb-1">${review.userId?.name || 'Anonymous'}</h5>
                        <div class="stars mb-1">${stars}</div>
                        <p class="text-muted small mb-0">
                            ${date}
                            ${review.isVerifiedPurchase ? '<span class="badge badge-success ml-2">Verified Purchase</span>' : ''}
                        </p>
                    </div>
                </div>
                <h6 class="mb-2">${review.title}</h6>
                <p class="mb-2">${review.comment}</p>
                <button class="btn btn-sm btn-outline-secondary helpful-btn" data-review-id="${review._id}">
                    <i class="ion-ios-thumbs-up"></i> 
                    Helpful (<span class="helpful-count">${review.helpfulCount}</span>)
                </button>
            </div>
        `;
    }

    function attachHelpfulListeners() {
        document.querySelectorAll('.helpful-btn').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });
        document.querySelectorAll('.helpful-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const reviewId = this.dataset.reviewId;
                try {
                    const response = await fetch(`/review/helpful/${reviewId}`, {
                        method: 'POST'
                    });
                    const result = await response.json();
                    if (result.success) {
                        this.querySelector('.helpful-count').textContent = result.helpfulCount;
                        this.classList.toggle('marked', result.helpful);
                    }
                } catch (error) {
                    console.error('Error:', error);
                }
            });
        });
    }

    // Reset modal when closed
    if (typeof $ !== 'undefined') {
        $('#reviewModal').on('hidden.bs.modal', function() {
            if (reviewForm) {
                reviewForm.reset();
                ratingInput.value = '0';
                updateStarDisplay(0);
                if (commentCount) commentCount.textContent = '0';
            
                // Reset edit mode
                document.getElementById('reviewId').value = '';
                document.getElementById('isEditing').value = 'false';
                document.getElementById('reviewModalTitle').textContent = 'Write a Review';
                submitBtn.innerHTML = '<i class="ion-ios-checkmark"></i> Submit Review';
                submitBtn.disabled = false;
            }
        });
    }
});